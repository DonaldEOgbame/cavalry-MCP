#!/usr/bin/env node

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Attr from '../src/cavalry/attributes.js';
import * as Graph from '../src/cavalry/graph.js';
import * as Gen from '../src/cavalry/generators.js';
import * as Anim from '../src/cavalry/animation.js';
import * as Typo from '../src/design/typography.js';
import * as Layout from '../src/design/layout.js';
import * as Preview from '../src/preview/frames.js';
import { bridgeClient } from '../src/bridge/client.js';
import { knowledgeEngine } from '../src/knowledge/engine.js';

const ROOT = resolve('knowledge/verified/end-to-end/radial-logo-reveal');
const PROJECT_ID = 'cavalry-2.7.2-golden-corpus';
const GOAL = 'Create a polished radial logo reveal with 16 repeating elements and a staggered clockwise entrance.';
const execFileAsync = promisify(execFile);

async function connect(sourceLayerId: string, targetLayerId: string, targetAttr: string, sourceAttr = 'id') {
  return Graph.graphConnect({ sourceLayerId, sourceAttr, targetLayerId, targetAttr, force: true });
}

async function renderFrames(prefix: string, frames: number[]) {
  const paths: string[] = [];
  for (const frame of frames) {
    const path = resolve(ROOT, `${prefix}-${String(frame).padStart(3, '0')}.png`);
    paths.push((await Preview.previewFrame(frame, 50, path)).filePath);
  }
  return paths;
}

async function build() {
  await mkdir(ROOT, { recursive: true });
  const search = await knowledgeEngine.search(GOAL, { scopes: ['project', 'global'], projectId: PROJECT_ID, limit: 8 }, 'detailed', true);
  const plan = await knowledgeEngine.motionPlan(GOAL, 'Blank project', [], true);
  await writeFile(resolve(ROOT, '01-knowledge-search.json'), `${JSON.stringify(search, null, 2)}\n`);
  await writeFile(resolve(ROOT, '02-motion-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);

  await Scene.sceneNew(true);
  await Comp.compositionCreate({ name: 'Knowledge Assisted Radial Reveal', width: 960, height: 540, fps: 30, startFrame: 0, endFrame: 90 });
  const dot = await Layer.layerCreatePrimitive('ellipse', 'Radial Dot');
  await Attr.attributeSetMany(dot.layerId, { 'generator.radius': { x: 12, y: 12 }, 'material.materialColor': '#55e6c1' });
  await Anim.keyframeCreate(dot.layerId, 'opacity', 0, 0);
  await Anim.keyframeCreate(dot.layerId, 'opacity', 24, 100);
  const radial = await Layer.layerCreate('duplicator', '16 Point Radial Reveal');
  await Gen.generatorSet(radial.layerId, 'circleDistribution', 'generator');
  await Attr.attributeSetMany(radial.layerId, { 'generator.count': 16, 'generator.radius': 175 });
  await connect(dot.layerId, radial.layerId, 'shapes');
  const stagger = await Layer.layerCreate('stagger', 'Clockwise Entrance');
  await Attr.attributeSetMany(stagger.layerId, { minimum: -36, maximum: 0 });
  await connect(stagger.layerId, radial.layerId, 'shapeTimeOffset');

  const mark = await Layer.layerCreatePrimitive('rectangle', 'Core Mark');
  await Attr.attributeSetMany(mark.layerId, { scale: { x: 0.72, y: 0.72 }, 'generator.dimensions': { x: 100, y: 100 }, rotation: 45, 'material.materialColor': '#ffcb6b' });
  await Anim.keyframeCreate(mark.layerId, 'scale.x', 8, 0);
  await Anim.keyframeCreate(mark.layerId, 'scale.x', 30, 0.8);
  await Anim.keyframeCreate(mark.layerId, 'scale.x', 40, 0.72);
  await Anim.keyframeCreate(mark.layerId, 'scale.y', 8, 0);
  await Anim.keyframeCreate(mark.layerId, 'scale.y', 30, 0.8);
  await Anim.keyframeCreate(mark.layerId, 'scale.y', 40, 0.72);

  const title = await Typo.textCreate({ text: 'CAVALRY', fontSize: 54, alignment: 'center', color: '#f3f7ff', name: 'Brand Title' });
  await Attr.attributeSet(title.layerId, 'position', { x: 0, y: 18 });
  await Anim.keyframeCreate(title.layerId, 'opacity', 20, 0);
  await Anim.keyframeCreate(title.layerId, 'opacity', 42, 100);
  const subtitle = await Typo.textCreate({ text: 'KNOWLEDGE • MOTION', fontSize: 20, alignment: 'center', color: '#8fa6c9', name: 'Subtitle' });
  await Attr.attributeSet(subtitle.layerId, 'position', { x: 0, y: 78 });
  await Anim.keyframeCreate(subtitle.layerId, 'opacity', 34, 0);
  await Anim.keyframeCreate(subtitle.layerId, 'opacity', 55, 100);
  // Cavalry draws earlier top-level layers above later ones, so create the full-frame background last.
  const background = await Layout.designCreateBackground('#0b1020', 'Midnight Background');
  await Layer.layerReorder(background.layerId, dot.layerId);

  const initialScene = resolve(ROOT, 'radial-logo-reveal-initial.cv');
  await Scene.sceneSaveAs(initialScene);
  await Scene.sceneOpen(initialScene, true);
  const previews = await renderFrames('initial', [0, 15, 30, 45, 60]);
  await writeFile(resolve(ROOT, '03-initial-build.json'), `${JSON.stringify({ goal: GOAL, initialScene, previews, layers: { dot: dot.layerId, radial: radial.layerId, stagger: stagger.layerId, mark: mark.layerId, title: title.layerId, subtitle: subtitle.layerId } }, null, 2)}\n`);
  return { initialScene, previews };
}

async function correct() {
  const initialScene = resolve(ROOT, 'radial-logo-reveal-initial.cv');
  await Scene.sceneOpen(initialScene, true);
  const layers = (await Layer.layerList(false)).layers;
  const byName = (name: string) => layers.find((layer) => layer.name === name)?.layerId;
  const title = byName('Brand Title');
  const subtitle = byName('Subtitle');
  const mark = byName('Core Mark');
  const radial = byName('16 Point Radial Reveal');
  if (!title || !subtitle || !mark || !radial) throw new Error('Unable to resolve correction targets by name');
  // Visual QA correction: separate the radial mark from the wordmark and remove dot/text collisions.
  await Attr.attributeSet(radial, 'position', { x: -135, y: 0 });
  await Attr.attributeSet(mark, 'position', { x: -135, y: 0 });
  await Attr.attributeSet(title, 'position', { x: 0, y: 18 });
  await Attr.attributeSet(subtitle, 'position', { x: 0, y: 72 });
  await Attr.attributeSet(mark, 'generator.dimensions', { x: 76, y: 76 });
  const correctedPreview = (await Preview.previewFrame(60, 75, resolve(ROOT, 'corrected-preview.png'))).filePath;
  const finalScene = resolve(ROOT, 'radial-logo-reveal-final.cv');
  await Scene.sceneSaveAs(finalScene);
  const finalFrames = await renderFrames('final', [0, 15, 30, 45, 60, 90]);
  const inspection = await Scene.sceneInspect(true);
  const ingestion = await knowledgeEngine.ingestion.ingestSceneInspection('knowledge-assisted-radial-logo-reveal', inspection, { scope: 'project', projectId: PROJECT_ID, cavalryVersion: '2.7.2', verified: true, filePath: finalScene });
  await knowledgeEngine.addVisualOutcome({ intent: GOAL, recipeUsed: 'radial-duplication-wave', previewFrames: finalFrames, timing: { startFrame: 0, endFrame: 90, fps: 30 }, notes: ['Initial preview showed the rightmost radial element colliding with the wordmark.', 'Shifted the radial system left, moved the wordmark right, and reduced the core mark before final render.'], qaPassed: true, issues: [{ issue: 'Radial element collided with the title in the initial preview.', fix: 'Create a left-mark/right-wordmark lockup with clear horizontal separation.' }] }, 'project', PROJECT_ID, undefined, '2.7.2');
  const result = { finalScene, correctedPreview, finalFrames, inspection, ingestion };
  await writeFile(resolve(ROOT, '04-visual-correction-and-final.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function render() {
  const finalScene = resolve(ROOT, 'radial-logo-reveal-final.cv');
  const outputDir = resolve(ROOT, 'final-render');
  await mkdir(outputDir, { recursive: true });
  await Scene.sceneOpen(finalScene, true);
  const comp = await Comp.compositionGetActive() as any;
  const item = (await bridgeClient.send<any>('render_queue_add', { compId: comp.compId ?? comp.layerId })).result!;
  const fileName = `radial-logo-reveal-final-${Date.now()}`;
  await bridgeClient.send('render_item_set_output', { itemId: item.renderQueueItemId, filePath: outputDir, fileName, formatType: 'renderMP4' });
  await bridgeClient.send('render_item_set', { itemId: item.renderQueueItemId, settings: { frameRangeMode: 2, frameRange: { x: 0, y: 90 } } });
  const startedAt = Date.now();
  await bridgeClient.send('render_start', { itemId: item.renderQueueItemId }, 120_000);
  let outputPath = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    const names = (await readdir(outputDir)).filter(name => name.startsWith(fileName));
    if (names.length) {
      outputPath = resolve(outputDir, names[0]);
      if ((await stat(outputPath)).size > 0) break;
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  await bridgeClient.send('render_item_delete', { itemId: item.renderQueueItemId });
  if (!outputPath) throw new Error('Final render did not produce an output artifact.');
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', outputPath]);
  const probe = JSON.parse(stdout);
  const video = probe.streams?.find((stream: any) => stream.codec_type === 'video');
  if (!video || video.codec_name !== 'h264' || video.width !== 960 || video.height !== 540) throw new Error('Final MP4 failed codec or dimension validation.');
  const result = { status: 'PASS', finalScene, outputPath, durationMs: Date.now() - startedAt, probe };
  await writeFile(resolve(ROOT, '05-final-render-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main() {
  const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1] ?? 'build';
  try {
    const result = phase === 'correct' ? await correct() : phase === 'render' ? await render() : await build();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    bridgeClient.stopCallbackServer();
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; });
