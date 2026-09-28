import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultSampleFrames, evaluateArtifact, lumaStatistics, MediaFacts, parseFrameRate, validateArtifact } from '../../src/render/artifact.js';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const expectation = { codec: 'h264', width: 320, height: 180, fps: 30, frameCount: 60 };

function facts(overrides: Partial<MediaFacts> = {}): MediaFacts {
  return {
    exists: true, size: 50_000, modifiedAt: Date.now(), probed: true, codec: 'h264', width: 320, height: 180, fps: 30, frameCount: 60, durationSeconds: 2,
    samples: [0, 1, 2].map((frame) => ({ frame, decoded: true, contrast: 120, signature: `sig-${frame}` })),
    ...overrides,
  };
}

describe('render artifact evaluation (pure)', () => {
  it('passes only when every check passes', () => {
    const report = evaluateArtifact('/x.mp4', facts(), expectation);
    assert.equal(report.verified, true, JSON.stringify(report.failures));
  });

  it('names the zero-byte container failure explicitly', () => {
    const report = evaluateArtifact('/x.mp4', { exists: true, size: 0, probed: false, probeError: 'zero-byte container', samples: [] }, expectation);
    assert.equal(report.verified, false);
    assert.deepEqual(report.failures, ['non_empty', 'decodable']);
    assert.equal(report.checks.find((item) => item.name === 'non_empty')?.detail, 'zero-byte container');
  });

  it('rejects a 250-frame file when 3,120 frames were requested (the range-reset bug class)', () => {
    const report = evaluateArtifact('/x.mp4', facts({ width: 1920, height: 1080, frameCount: 250, durationSeconds: 8.333 }), { codec: 'h264', width: 1920, height: 1080, fps: 30, frameCount: 3120 });
    assert.deepEqual(report.failures, ['frame_count', 'duration']);
  });

  it('rejects wrong frame rate, stale files, blank samples, and frozen output', () => {
    assert.ok(evaluateArtifact('/x.mp4', facts({ fps: 25 }), expectation).failures.includes('fps'));
    assert.ok(evaluateArtifact('/x.mp4', facts({ modifiedAt: 1_000 }), { ...expectation, notBefore: 10_000 }).failures.includes('fresh'));
    const blank = facts({ samples: [{ frame: 5, decoded: true, contrast: 2, signature: 'a' }, { frame: 9, decoded: true, contrast: 90, signature: 'b' }, { frame: 12, decoded: true, contrast: 90, signature: 'c' }] });
    assert.ok(evaluateArtifact('/x.mp4', blank, expectation).failures.includes('frames_non_blank'));
    assert.equal(evaluateArtifact('/x.mp4', blank, { ...expectation, allowBlankFrames: 1 }).verified, true);
    const frozen = facts({ samples: [0, 1, 2].map((frame) => ({ frame, decoded: true, contrast: 90, signature: 'same' })) });
    assert.ok(evaluateArtifact('/x.mp4', frozen, expectation).failures.includes('frames_not_frozen'));
    assert.equal(evaluateArtifact('/x.mp4', frozen, { ...expectation, allowStaticContent: true }).verified, true);
  });

  it('parses frame rates and spaces samples away from the first and last frame', () => {
    assert.equal(parseFrameRate('30000/1001')?.toFixed(3), '29.970');
    assert.equal(parseFrameRate('0/0'), undefined);
    const samples = defaultSampleFrames(3120);
    assert.equal(samples.length, 8);
    assert.ok(samples[0] > 0 && samples[7] < 3119);
    assert.deepEqual(defaultSampleFrames(3), [0, 1, 2]);
  });

  it('computes luma contrast and a stable signature', () => {
    const flat = new Uint8Array(64 * 36).fill(16);
    const flatStats = lumaStatistics(flat, 64, 36);
    assert.equal(flatStats.contrast, 0);
    const split = new Uint8Array(64 * 36).map((_, index) => (index % 64 < 32 ? 16 : 235));
    const splitStats = lumaStatistics(split, 64, 36);
    assert.equal(splitStats.contrast, 219);
    assert.notEqual(flatStats.signature, splitStats.signature);
    assert.equal(lumaStatistics(split, 64, 36).signature, splitStats.signature);
  });
});

describe('render artifact validation against real encoded media', { skip: !hasFfmpeg && 'ffmpeg/ffprobe not installed' }, () => {
  let directory = '';
  const encode = (name: string, source: string, seconds = 2, extra: string[] = []) => {
    const target = path.join(directory, name);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', source, '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...extra, target]);
    return target;
  };

  before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-')); });
  after(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('verifies a correct H.264 render', async () => {
    const report = await validateArtifact(encode('good.mp4', 'testsrc2=size=320x180:rate=30'), expectation);
    assert.equal(report.verified, true, JSON.stringify(report.checks.filter((item) => !item.ok)));
    assert.equal(report.facts.frameCount, 60);
    assert.equal(report.facts.samples.length, 8);
  });

  it('rejects black, static, wrong-rate, and short renders', async () => {
    assert.ok((await validateArtifact(encode('black.mp4', 'color=c=black:size=320x180:rate=30'), expectation)).failures.includes('frames_non_blank'));
    assert.ok((await validateArtifact(encode('static.mp4', 'smptebars=size=320x180:rate=30'), expectation)).failures.includes('frames_not_frozen'));
    const wrongRate = await validateArtifact(encode('fps25.mp4', 'testsrc2=size=320x180:rate=25'), expectation);
    assert.ok(wrongRate.failures.includes('fps') && wrongRate.failures.includes('frame_count'));
    assert.ok((await validateArtifact(encode('short.mp4', 'testsrc2=size=320x180:rate=30', 1), expectation)).failures.includes('frame_count'));
  });

  it('rejects zero-byte and truncated containers', async () => {
    const zero = path.join(directory, 'zero.mp4');
    fs.writeFileSync(zero, '');
    assert.deepEqual((await validateArtifact(zero, expectation)).failures, ['non_empty', 'decodable']);
    const good = fs.readFileSync(encode('source.mp4', 'testsrc2=size=320x180:rate=30'));
    const truncated = path.join(directory, 'truncated.mp4');
    fs.writeFileSync(truncated, good.subarray(0, Math.floor(good.length * 0.6)));
    assert.ok((await validateArtifact(truncated, expectation)).failures.includes('decodable'));
  });

  it('rejects a missing file', async () => {
    assert.deepEqual((await validateArtifact(path.join(directory, 'missing.mp4'), expectation)).failures, ['exists', 'non_empty', 'decodable']);
  });
});
