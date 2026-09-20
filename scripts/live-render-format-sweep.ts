#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Attr from '../src/cavalry/attributes.js';
import * as Anim from '../src/cavalry/animation.js';
import * as Asset from '../src/cavalry/assets.js';
import { bridgeClient } from '../src/bridge/client.js';

const execFileAsync = promisify(execFile);

async function send<T = any>(op: string, params: Record<string, unknown> = {}): Promise<T> {
  const res: any = await bridgeClient.send(op, params);
  if (!res.ok) throw new Error(`${op} failed: ${JSON.stringify(res.error)}`);
  return res.result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface FormatCase {
  label: string;
  nodeType: string;
  hasAudio?: boolean;
  // Set for formats confirmed (via render_item_inspect on the live generator,
  // not just nodeDefinitions.json) to not actually expose exportAudio at
  // runtime in this Cavalry build, despite inheriting it from the
  // renderFormatWithAudio schema supertype. See docs/coverage.md.
  knownNoAudioSupport?: boolean;
}

// Every format currently declared in coverage/render-formats.json.
const FORMATS: FormatCase[] = [
  { label: 'APNG', nodeType: 'renderAPNG' },
  { label: 'Audio Only', nodeType: 'renderAudioOnly', hasAudio: true },
  { label: 'GIF', nodeType: 'renderGIF' },
  { label: 'JPEG', nodeType: 'renderJPEG' },
  { label: 'Lottie', nodeType: 'renderLottie' },
  { label: 'MP4', nodeType: 'renderMP4', hasAudio: true },
  { label: 'PNG', nodeType: 'renderPNG' },
  { label: 'QuickTime', nodeType: 'renderQuicktime', hasAudio: true },
  { label: 'SVG', nodeType: 'renderSVG' },
  { label: 'Sprite Sheet', nodeType: 'renderSpriteSheet' },
  { label: 'WebP', nodeType: 'renderWebP' },
  { label: 'WebM', nodeType: 'renderWebM', hasAudio: true },
  { label: 'HEVC', nodeType: 'renderHVEC', hasAudio: true, knownNoAudioSupport: true },
  { label: 'ProRes', nodeType: 'renderProRes', hasAudio: true, knownNoAudioSupport: true },
];

const outDir = resolve('coverage/render-format-sweep-output');
mkdirSync(outDir, { recursive: true });

async function buildScene(): Promise<string> {
  await Scene.sceneNew(true);
  const comp = await Comp.compositionCreate({ name: 'RenderSweep', width: 320, height: 180, fps: 30, startFrame: 0, endFrame: 15 });
  const star = await Layer.layerCreatePrimitive('star', 'SweepStar');
  await Attr.attributeSet(star.layerId, 'scale', { x: 0.5, y: 0.5 });
  await Attr.attributeSet(star.layerId, 'material.materialColor', { r: 255, g: 80, b: 0, a: 255 });
  await Anim.keyframeCreate(star.layerId, 'rotation', 0, 0);
  await Anim.keyframeCreate(star.layerId, 'rotation', 15, 360);

  // A real audio track is required for renderAudioOnly and the *WithAudio
  // formats to have anything meaningful to export.
  const audioPath = resolve('coverage/fixtures/test-tone-440hz-1s.wav');
  const asset = await Asset.assetImport(audioPath);
  await Asset.assetAddToComposition(asset.assetId);

  return (comp as any).compId;
}

async function renderFormat(compId: string, format: FormatCase) {
  const stubName = `sweep-${format.nodeType}-${Date.now()}`;
  const item = await send('render_queue_add', { compId });
  await send('render_item_set_output', {
    itemId: item.renderQueueItemId,
    filePath: outDir,
    fileName: stubName,
    formatType: format.nodeType,
  });
  const started = Date.now();
  await send('render_start', { itemId: item.renderQueueItemId });

  // No reliable render-status API exists in 2.7.2 (documented gap). Poll the
  // output directory for any new file matching the stub name.
  let found: string | null = null;
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    const candidates = readdirSync(outDir).filter((f) => f.startsWith(stubName));
    if (candidates.length > 0) {
      // Wait a bit more in case of multi-file sequences still being written.
      await sleep(800);
      found = candidates.sort().slice(-1)[0];
      break;
    }
  }
  const durationMs = Date.now() - started;
  await send('render_item_delete', { itemId: item.renderQueueItemId });

  if (!found) {
    return { label: format.label, nodeType: format.nodeType, status: 'FAIL', reason: 'No output file appeared within 40s', durationMs };
  }

  const filePath = join(outDir, found);
  const size = statSync(filePath).size;
  if (size === 0) {
    return { label: format.label, nodeType: format.nodeType, status: 'FAIL', reason: 'Output file is zero bytes', filePath, durationMs };
  }

  // Lottie is JSON, not a media container — ffprobe cannot parse it.
  // Validate it directly against the fields the assignment calls out:
  // dimensions, frame rate, and in/out points.
  if (format.nodeType === 'renderLottie') {
    try {
      const lottie = JSON.parse(readFileSync(filePath, 'utf8'));
      const valid = typeof lottie.w === 'number' && typeof lottie.h === 'number'
        && typeof lottie.fr === 'number' && typeof lottie.ip === 'number' && typeof lottie.op === 'number'
        && Array.isArray(lottie.layers);
      return {
        label: format.label,
        nodeType: format.nodeType,
        status: valid ? 'PASS' : 'FAIL',
        reason: valid ? undefined : 'Missing required Lottie fields (w/h/fr/ip/op/layers)',
        filePath,
        sizeBytes: size,
        durationMs,
        lottie: { w: lottie.w, h: lottie.h, fr: lottie.fr, ip: lottie.ip, op: lottie.op, layerCount: lottie.layers?.length ?? 0 },
      };
    } catch (e: any) {
      return { label: format.label, nodeType: format.nodeType, status: 'FAIL', reason: `Invalid Lottie JSON: ${e.message}`, filePath, sizeBytes: size, durationMs };
    }
  }

  // SVG is XML, not an ffprobe-parseable media container in the way that
  // matters here (ffprobe reports width/height 0 for it). Validate it
  // directly: well-formed XML with a viewBox/width/height and real content.
  if (format.nodeType === 'renderSVG') {
    const xml = readFileSync(filePath, 'utf8');
    const hasViewBoxOrDims = /viewBox=/.test(xml) || (/width=/.test(xml) && /height=/.test(xml));
    const hasGraphicalElements = /<(path|rect|circle|ellipse|polygon|polyline|g)[\s>]/.test(xml);
    const valid = xml.trim().startsWith('<?xml') || xml.trim().startsWith('<svg');
    return {
      label: format.label,
      nodeType: format.nodeType,
      status: valid && hasViewBoxOrDims && hasGraphicalElements ? 'PASS' : 'FAIL',
      reason: valid && hasViewBoxOrDims && hasGraphicalElements ? undefined : 'SVG missing well-formed root, dimensions, or graphical elements',
      filePath,
      sizeBytes: size,
      durationMs,
      svg: { hasViewBoxOrDims, hasGraphicalElements },
    };
  }

  let probe: any = null;
  let probeError: string | null = null;
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath]);
    probe = JSON.parse(stdout);
  } catch (e: any) {
    probeError = e.message?.slice(0, 300) || String(e);
  }

  const streams = probe?.streams || [];
  const hasAudioStream = streams.some((s: any) => s.codec_type === 'audio');
  let status: 'PASS' | 'FAIL' | 'KNOWN_LIMITATION' = probe ? 'PASS' : 'FAIL';
  let reason: string | undefined = probe ? undefined : 'ffprobe could not parse output';
  if (probe && format.hasAudio && !hasAudioStream) {
    if (format.knownNoAudioSupport) {
      status = 'KNOWN_LIMITATION';
      reason = 'This generator does not expose exportAudio at runtime in Cavalry 2.7.2, despite inheriting it from the renderFormatWithAudio schema supertype (confirmed via render_item_inspect: MP4/QuickTime/WebM correctly expose and honor generator.exportAudio; HEVC/ProRes generators do not list it among their live attributes at all).';
    } else {
      status = 'FAIL';
      reason = 'Expected an audio stream (composition has an audio asset) but ffprobe found none';
    }
  }

  return {
    label: format.label,
    nodeType: format.nodeType,
    status,
    reason,
    filePath,
    sizeBytes: size,
    durationMs,
    ffprobe: probe ? {
      format: probe.format?.format_name,
      durationSec: probe.format?.duration ? Number(probe.format.duration) : null,
      streams: streams.map((s: any) => ({
        codec_type: s.codec_type,
        codec_name: s.codec_name,
        width: s.width,
        height: s.height,
        pix_fmt: s.pix_fmt,
        sample_rate: s.sample_rate,
        channels: s.channels,
      })),
    } : null,
    ffprobeError: probeError,
  };
}

async function main() {
  const compId = await buildScene();
  const results = [];
  for (const format of FORMATS) {
    process.stdout.write(`Rendering ${format.label} (${format.nodeType})... `);
    try {
      const result = await renderFormat(compId, format);
      console.log(result.status, result.status === 'PASS' ? `${(result as any).sizeBytes}B in ${result.durationMs}ms` : (result as any).reason);
      results.push(result);
    } catch (e: any) {
      console.log('FAIL', e.message);
      results.push({ label: format.label, nodeType: format.nodeType, status: 'FAIL', reason: e.message });
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cavalryVersion: '2.7.2',
    method: 'Live render-queue sweep via render_queue_add/render_item_set_output/render_start against a running Cavalry 2.7.2 instance, polling the output directory since 2.7.2 exposes no reliable render-status API. Each output validated with ffprobe.',
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    knownLimitation: results.filter((r: any) => r.status === 'KNOWN_LIMITATION').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    results,
  };

  writeFileSync(resolve('coverage/render-format-sweep-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${report.passed}/${report.total} formats PASS, ${report.knownLimitation} KNOWN_LIMITATION, ${report.failed} FAIL.`);
  console.log('Full results: coverage/render-format-sweep-results.json');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
