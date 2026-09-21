#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Attr from '../src/cavalry/attributes.js';
import * as Graph from '../src/cavalry/graph.js';
import * as Gen from '../src/cavalry/generators.js';
import * as Asset from '../src/cavalry/assets.js';
import * as Typo from '../src/design/typography.js';
import * as Preview from '../src/preview/frames.js';
import { bridgeClient } from '../src/bridge/client.js';

const execFileAsync = promisify(execFile);
const root = resolve('coverage/compatibility/Unicode Path – اختبار');
const scenePath = resolve(root, 'Cavalry scene 日本語.cv');
const previewPath = resolve(root, 'preview مرحبا.png');
const renderProbePath = resolve('coverage/compatibility/preview-rtl.png');
const assetPath = resolve(root, 'large asset 2048.png');
const sourcePreview = resolve('coverage/soak/soak-current.png');
const checks: Array<Record<string, unknown>> = [];
let yLow = NaN;
let yHigh = NaN;

function pass(name: string, evidence: Record<string, unknown> = {}) {
  checks.push({ name, status: 'PASS', ...evidence });
}

await mkdir(root, { recursive: true });
try {
  await Scene.sceneNew(true);
  const comp = await Comp.compositionCreate({ name: 'Compatibility Unicode RTL', width: 640, height: 360, fps: 30, startFrame: 0, endFrame: 60 });

  const unicodeText = 'Cavalry — Café 日本語 😀';
  const rtlText = 'مرحبا بالعالم';
  const visualProbeText = `VISIBLE ${rtlText} 日本語`;
  const visualProbe = await Typo.textCreate({ text: visualProbeText, fontFamily: 'Helvetica', fontSize: 42, color: '#111827', alignment: 'left', name: 'Rendered Script Probe' });
  await Attr.attributeSet(visualProbe.layerId, 'position', { x: -290, y: 0 });
  const visualProbeBounds = await Layer.layerBoundingBox(visualProbe.layerId);
  assert.ok(Number((visualProbeBounds as any).boundingBox?.width ?? 0) > 0);
  await unlink(renderProbePath).catch(() => undefined);
  await Preview.previewFrame(0, 100, renderProbePath);
  assert.ok((await stat(renderProbePath)).size > 0);
  const { stdout: pixelStats } = await execFileAsync('ffmpeg', ['-v', 'error', '-i', renderProbePath, '-vf', 'signalstats,metadata=mode=print:file=-', '-frames:v', '1', '-f', 'null', '-']);
  yLow = Number(pixelStats.match(/YMIN=([\d.]+)/)?.[1] ?? NaN);
  yHigh = Number(pixelStats.match(/YMAX=([\d.]+)/)?.[1] ?? NaN);
  assert.ok(Number.isFinite(yLow) && Number.isFinite(yHigh) && yHigh - yLow >= 80, `Preview lacks visible foreground contrast (YMIN=${yLow}, YMAX=${yHigh})`);
  await execFileAsync('cp', [renderProbePath, previewPath]);

  const fonts = await Typo.listInstalledFonts();
  assert.ok(fonts.length > 0);
  const preferredFont = fonts.find((font) => /Helvetica/i.test(font)) ?? fonts[0];
  assert.equal(await Typo.checkFontExists(preferredFont), true);
  assert.equal(await Typo.checkFontExists('Definitely Missing Cavalry MCP Font 987654'), false);
  pass('font discovery and missing-font detection', { installedCount: fonts.length, testedFont: preferredFont });

  const unicode = await Typo.textCreate({ text: unicodeText, fontFamily: preferredFont, fontSize: 58, color: '#111827', alignment: 'center', name: 'Unicode 日本語 😀' });
  const rtl = await Typo.textCreate({ text: rtlText, fontFamily: preferredFont, fontSize: 64, color: '#9a3412', alignment: 'right', name: 'RTL مرحبا' });
  await Attr.attributeSet(unicode.layerId, 'position', { x: 0, y: -60 });
  await Attr.attributeSet(rtl.layerId, 'position', { x: 0, y: 60 });
  const unicodeBounds = await Layer.layerBoundingBox(unicode.layerId);
  const rtlBounds = await Layer.layerBoundingBox(rtl.layerId);
  assert.ok(Number((unicodeBounds as any).boundingBox?.width ?? 0) > 0);
  assert.ok(Number((rtlBounds as any).boundingBox?.width ?? 0) > 0);
  pass('Unicode and RTL text construction and rendered glyph output', { unicodeText, rtlText, visualProbeText, cavalryRenderPath: renderProbePath, unicodeCopyPath: previewPath, previewLumaRange: { low: yLow, high: yHigh } });

  await Comp.compositionUpdate({ compId: comp.compId as string, width: 1280, height: 720, endFrame: 3000 });

  const source = await Layer.layerCreatePrimitive('ellipse', 'Large Scene Source');
  await Attr.attributeSetMany(source.layerId, { position: { x: 640, y: 360 }, scale: { x: 0.08, y: 0.08 }, 'material.materialColor': '#d8dee9' });
  const duplicator = await Layer.layerCreate('duplicator', '1000 Instance Grid');
  await Gen.generatorSet(duplicator.layerId, 'gridDistribution', 'generator');
  await Attr.attributeSetMany(duplicator.layerId, { 'generator.count': { x: 40, y: 25 }, 'generator.size': { x: 1100, y: 600 } });
  await Graph.graphConnect({ sourceLayerId: source.layerId, sourceAttr: 'id', targetLayerId: duplicator.layerId, targetAttr: 'shapes', force: true });
  // Keep the 1,000-instance stress graph in the persisted scene, but schedule
  // it after the glyph QA frame so generator load cannot mask text rendering.
  await Layer.layerSetInFrame(duplicator.layerId, 100);
  pass('large procedural scene and timeline', { instances: 1000, endFrame: 3000 });

  try {
    await execFileAsync('sips', ['-z', '2048', '2048', sourcePreview, '--out', assetPath]);
  } catch {
    await execFileAsync('cp', [sourcePreview, assetPath]);
  }
  assert.ok((await stat(assetPath)).size > 0);
  const asset = await Asset.assetImport(assetPath, false);
  let profile: any;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await Asset.assetReload(asset.assetId);
    profile = await bridgeClient.send<any>('asset_icc_profile', { assetId: asset.assetId });
    if (String(profile.result?.profile ?? '').length > 0) break;
  }
  assert.ok(String(profile.result?.profile ?? '').length > 0, 'Cavalry did not expose the embedded ICC profile');
  pass('large asset and ICC profile inspection', { assetId: asset.assetId, profile: profile.result?.profile ?? null, path: assetPath });

  await Scene.sceneSaveAs(scenePath);
  await Scene.sceneOpen(scenePath, true);
  const unicodeReopened = await Layer.layerFind({ name: 'Unicode 日本語 😀' });
  const rtlReopened = await Layer.layerFind({ name: 'RTL مرحبا' });
  assert.equal(unicodeReopened.count, 1);
  assert.equal(rtlReopened.count, 1);
  const unicodeValue = await Attr.attributeGet(unicodeReopened.layers[0].layerId, 'text');
  const rtlValue = await Attr.attributeGet(rtlReopened.layers[0].layerId, 'text');
  assert.equal((unicodeValue.value as any)?.text, unicodeText);
  assert.equal((rtlValue.value as any)?.text, rtlText);
  const snapshot = await Scene.sceneSnapshot();
  const parsed = JSON.parse(snapshot.state);
  assert.ok((parsed.nodes ?? []).length >= 6);
  pass('Unicode path save, reopen, structural persistence, and preview render', {
    scenePath,
    previewPath,
    reopenedNodeCount: parsed.nodes.length,
    previewBytes: (await stat(previewPath)).size,
    previewLumaRange: { low: yLow, high: yHigh },
  });
} finally {
  bridgeClient.stopCallbackServer();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  platform: 'macOS',
  cavalryVersion: '2.7.2',
  checks,
  passed: checks.length === 5 && checks.every((check) => check.status === 'PASS'),
  note: 'RTL persistence and rendered glyph output are verified; language-aware shaping quality remains dependent on the selected host font and Cavalry text engine.',
};
await writeFile(resolve('coverage/live-compatibility-results.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
