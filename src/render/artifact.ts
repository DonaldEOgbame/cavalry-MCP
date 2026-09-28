import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * A render succeeds only when its artifact proves it: the file exists, is
 * non-empty and fresh, decodes with the expected codec, resolution, frame
 * rate, exact frame count and duration, and representative frames are
 * neither blank nor frozen. API success alone is never accepted.
 */
export interface ArtifactExpectation {
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  frameCount?: number;
  /** Allowed |actual - expected| frames. Defaults to 0 (exact). */
  frameCountTolerance?: number;
  /** Earliest acceptable modification time (ms since epoch). */
  notBefore?: number;
  /** Frame indices within the file to decode. Defaults to evenly spaced samples. */
  sampleFrames?: number[];
  /** Number of sampled frames allowed to be blank. Defaults to 0. */
  allowBlankFrames?: number;
  /** Accept identical samples (e.g. an intentionally static title card). */
  allowStaticContent?: boolean;
  /** Minimum luma contrast (p99 - p1, 0–255) for a frame to count as non-blank. */
  minContrast?: number;
}

export interface FrameSample {
  frame: number;
  decoded: boolean;
  mean?: number;
  p1?: number;
  p99?: number;
  contrast?: number;
  blank?: boolean;
  signature?: string;
  error?: string;
}

export interface MediaFacts {
  exists: boolean;
  size: number;
  modifiedAt?: number;
  probed: boolean;
  probeError?: string;
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  frameCount?: number;
  durationSeconds?: number;
  pixelFormat?: string;
  samples: FrameSample[];
}

export interface ArtifactCheck {
  name: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
}

export interface ArtifactReport {
  path: string;
  verified: boolean;
  checks: ArtifactCheck[];
  failures: string[];
  facts: MediaFacts;
}

export function parseFrameRate(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator)) return undefined;
  const rate = denominator ? numerator / denominator : numerator;
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

export function defaultSampleFrames(frameCount: number, count = 8): number[] {
  if (frameCount <= 0) return [];
  if (frameCount <= count) return Array.from({ length: frameCount }, (_, index) => index);
  // Stay off the first/last frame, where fades legitimately touch black.
  const first = Math.min(frameCount - 1, Math.max(1, Math.round(frameCount * 0.02)));
  const last = Math.max(first, frameCount - 1 - first);
  return Array.from({ length: count }, (_, index) => Math.round(first + ((last - first) * index) / (count - 1)));
}

/** Luma statistics for one decoded grey frame (width × height bytes). */
export function lumaStatistics(pixels: Uint8Array, width: number, height: number): { mean: number; p1: number; p99: number; contrast: number; signature: string } {
  const histogram = new Array<number>(256).fill(0);
  let sum = 0;
  for (const value of pixels) { histogram[value] += 1; sum += value; }
  const total = pixels.length || 1;
  const percentile = (fraction: number) => {
    const target = fraction * total;
    let seen = 0;
    for (let level = 0; level < 256; level += 1) {
      seen += histogram[level];
      if (seen >= target) return level;
    }
    return 255;
  };
  const p1 = percentile(0.01);
  const p99 = percentile(0.99);
  // 16×9 block means, quantised, identify a frame for freeze detection.
  const blocksX = 16;
  const blocksY = 9;
  const blocks: number[] = [];
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      let blockSum = 0;
      let count = 0;
      const x0 = Math.floor((bx * width) / blocksX);
      const x1 = Math.floor(((bx + 1) * width) / blocksX);
      const y0 = Math.floor((by * height) / blocksY);
      const y1 = Math.floor(((by + 1) * height) / blocksY);
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) { blockSum += pixels[y * width + x]; count += 1; }
      }
      blocks.push(count ? Math.round(blockSum / count / 8) : 0);
    }
  }
  return {
    mean: Number((sum / total).toFixed(2)),
    p1,
    p99,
    contrast: p99 - p1,
    signature: crypto.createHash('sha1').update(Buffer.from(blocks)).digest('hex').slice(0, 16),
  };
}

export function evaluateArtifact(path: string, facts: MediaFacts, expectation: ArtifactExpectation): ArtifactReport {
  const checks: ArtifactCheck[] = [];
  const check = (name: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => checks.push({ name, ok, ...(expected !== undefined ? { expected } : {}), ...(actual !== undefined ? { actual } : {}), ...(detail ? { detail } : {}) });

  check('exists', facts.exists);
  check('non_empty', facts.exists && facts.size > 0, '> 0 bytes', facts.size, facts.exists && facts.size === 0 ? 'zero-byte container' : undefined);
  if (expectation.notBefore !== undefined) {
    check('fresh', facts.modifiedAt !== undefined && facts.modifiedAt >= expectation.notBefore - 1_000, new Date(expectation.notBefore).toISOString(), facts.modifiedAt ? new Date(facts.modifiedAt).toISOString() : null);
  }
  check('decodable', facts.probed, undefined, undefined, facts.probeError);
  if (facts.probed) {
    if (expectation.codec) check('codec', (facts.codec ?? '').toLowerCase() === expectation.codec.toLowerCase(), expectation.codec, facts.codec ?? null);
    if (expectation.width) check('width', facts.width === expectation.width, expectation.width, facts.width ?? null);
    if (expectation.height) check('height', facts.height === expectation.height, expectation.height, facts.height ?? null);
    if (expectation.fps) check('fps', facts.fps !== undefined && Math.abs(facts.fps - expectation.fps) < 0.01, expectation.fps, facts.fps ?? null);
    if (expectation.frameCount !== undefined) {
      const tolerance = expectation.frameCountTolerance ?? 0;
      check('frame_count', facts.frameCount !== undefined && Math.abs(facts.frameCount - expectation.frameCount) <= tolerance, expectation.frameCount, facts.frameCount ?? null);
      if (expectation.fps) {
        const expectedSeconds = expectation.frameCount / expectation.fps;
        const toleranceSeconds = Math.max(0.1, (tolerance + 1.5) / expectation.fps);
        check('duration', facts.durationSeconds !== undefined && Math.abs(facts.durationSeconds - expectedSeconds) <= toleranceSeconds, Number(expectedSeconds.toFixed(3)), facts.durationSeconds ?? null);
      }
    }
    const decoded = facts.samples.filter((sample) => sample.decoded);
    check('frames_decoded', facts.samples.length > 0 && decoded.length === facts.samples.length, facts.samples.length, decoded.length);
    const minContrast = expectation.minContrast ?? 8;
    const blank = decoded.filter((sample) => (sample.contrast ?? 0) < minContrast);
    check('frames_non_blank', blank.length <= (expectation.allowBlankFrames ?? 0), `≤ ${expectation.allowBlankFrames ?? 0} blank`, blank.map((sample) => sample.frame), blank.length ? `blank sampled frames: ${blank.map((sample) => sample.frame).join(', ')}` : undefined);
    if (decoded.length >= 3 && !expectation.allowStaticContent) {
      const distinct = new Set(decoded.map((sample) => sample.signature)).size;
      check('frames_not_frozen', distinct > 1, '> 1 distinct sampled frame', distinct);
    }
  }
  const failures = checks.filter((item) => !item.ok).map((item) => item.name);
  return { path, verified: failures.length === 0, checks, failures, facts };
}

async function probeStreams(filePath: string): Promise<Pick<MediaFacts, 'probed' | 'probeError' | 'codec' | 'width' | 'height' | 'fps' | 'frameCount' | 'durationSeconds' | 'pixelFormat'>> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-count_packets',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_packets,pix_fmt:format=duration',
      '-of', 'json', filePath,
    ], { maxBuffer: 4 * 1024 * 1024, timeout: 120_000 });
    const parsed = JSON.parse(stdout);
    const stream = parsed.streams?.[0];
    if (!stream) return { probed: false, probeError: 'no video stream' };
    return {
      probed: true,
      codec: stream.codec_name,
      width: Number(stream.width) || undefined,
      height: Number(stream.height) || undefined,
      fps: parseFrameRate(stream.avg_frame_rate) ?? parseFrameRate(stream.r_frame_rate),
      frameCount: stream.nb_read_packets !== undefined ? Number(stream.nb_read_packets) : undefined,
      durationSeconds: parsed.format?.duration !== undefined ? Number(parsed.format.duration) : undefined,
      pixelFormat: stream.pix_fmt,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { probed: false, probeError: code === 'ENOENT' ? 'ffprobe is not installed; artifacts cannot be validated' : String((error as { stderr?: string }).stderr || (error as Error).message).trim().slice(0, 500) };
  }
}

async function decodeSample(filePath: string, frame: number, fps: number, width: number, height: number): Promise<FrameSample> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', [
      '-v', 'error', '-ss', ((frame + 0.5) / fps).toFixed(6), '-i', filePath,
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
    ], { encoding: 'buffer', maxBuffer: width * height + 1024 * 1024, timeout: 120_000 }) as unknown as { stdout: Buffer };
    if (stdout.length < width * height) return { frame, decoded: false, error: `decoded ${stdout.length} of ${width * height} bytes` };
    const stats = lumaStatistics(new Uint8Array(stdout.buffer, stdout.byteOffset, width * height), width, height);
    return { frame, decoded: true, ...stats };
  } catch (error) {
    return { frame, decoded: false, error: String((error as Error).message).slice(0, 300) };
  }
}

export async function collectMediaFacts(filePath: string, expectation: ArtifactExpectation = {}): Promise<MediaFacts> {
  let info;
  try { info = await stat(filePath); } catch { return { exists: false, size: 0, probed: false, samples: [] }; }
  const base: MediaFacts = { exists: true, size: info.size, modifiedAt: info.mtimeMs, probed: false, samples: [] };
  if (info.size === 0) return { ...base, probeError: 'zero-byte container' };
  const streams = await probeStreams(filePath);
  const facts: MediaFacts = { ...base, ...streams };
  if (!facts.probed || !facts.width || !facts.height) return facts;
  const fps = facts.fps ?? expectation.fps ?? 30;
  const frameCount = facts.frameCount ?? Math.round((facts.durationSeconds ?? 0) * fps);
  const frames = (expectation.sampleFrames?.length ? expectation.sampleFrames : defaultSampleFrames(frameCount))
    .filter((frame) => frame >= 0 && frame < Math.max(frameCount, 1));
  for (const frame of frames) facts.samples.push(await decodeSample(filePath, frame, fps, facts.width, facts.height));
  return facts;
}

export async function validateArtifact(filePath: string, expectation: ArtifactExpectation): Promise<ArtifactReport> {
  return evaluateArtifact(filePath, await collectMediaFacts(filePath, expectation), expectation);
}

/** Extracts PNG frames from a validated artifact for visual inspection. */
export async function extractInspectionFrames(filePath: string, frames: number[], fps: number, outputStem: string, width = 480): Promise<Array<{ frame: number; path: string }>> {
  const extracted: Array<{ frame: number; path: string }> = [];
  for (const frame of frames) {
    const target = `${outputStem}-f${String(frame).padStart(5, '0')}.png`;
    await execFileAsync('ffmpeg', ['-v', 'error', '-y', '-ss', ((frame + 0.5) / fps).toFixed(6), '-i', filePath, '-frames:v', '1', '-vf', `scale=${width}:-2`, target], { timeout: 120_000 });
    extracted.push({ frame, path: target });
  }
  return extracted;
}
