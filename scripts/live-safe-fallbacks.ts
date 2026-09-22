#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp/server.js';
import { bridgeClient } from '../src/bridge/client.js';

const root = resolve('coverage/safe-fallbacks');
const scenePath = resolve(root, 'safe-fallbacks.cv');
const previewPath = resolve(root, 'timeline-preview.mp4');
const muxPath = resolve(root, 'verified-mux.mp4');
const audioPath = resolve('coverage/fixtures/test-tone-440hz-1s.wav');
const videoPath = resolve('knowledge/verified/end-to-end/radial-logo-reveal/final-render/radial-logo-reveal-final.mp4');
const reportPath = resolve('coverage/live-safe-fallback-results.json');
await mkdir(root, { recursive: true });

const server: any = createMcpServer();
const tools: Record<string, any> = server._registeredTools;
const results: any[] = [];

function parse(response: any): any {
  const text = response?.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : response;
}

async function invoke(tool: string, args: Record<string, unknown> = {}, expectedOk = true): Promise<any> {
  const started = Date.now();
  const payload = parse(await tools[tool].handler(args, {}));
  assert.equal(payload.ok, expectedOk, `${tool}: ${payload.error?.message ?? 'unexpected result'}`);
  results.push({ tool, status: expectedOk ? 'PASS' : 'KNOWN_HOST_LIMITATION', durationMs: Date.now() - started, args, payload });
  return payload.result;
}

try {
  await invoke('scene_new', { force: true });
  await invoke('composition_create', { name: 'Safe Fallback Validation', width: 320, height: 180, fps: 30, startFrame: 0, endFrame: 12, makeActive: true });
  const path = await invoke('path_create', { primitiveType: 'rectangle', name: 'Safe Morph Source' });
  const inspected = await invoke('path_inspect', { layerId: path.layerId, worldSpace: false });
  const fromPath = inspected.path;
  const toPath = structuredClone(fromPath);
  for (const point of toPath[0].points) {
    point.position.x *= 0.6;
    point.position.y *= 1.25;
  }

  const morph = await invoke('path_morph_safe', {
    layerId: path.layerId, startFrame: 0, endFrame: 6,
    fromPath, toPath, sampleEvery: 2,
  });
  assert.equal(morph.nativePathKeyframesUsed, false);
  assert.equal(morph.frameCount, 4);
  const middle = await invoke('path_get_editable', { layerId: morph.layers[1].layerId, worldSpace: false });
  assert.equal(middle.path[0].points[0].position.x, -86.66666666666667);
  const animation = await invoke('path_animation_safe', {
    layerId: path.layerId,
    keyframes: [
      { frame: 7, pathObject: fromPath },
      { frame: 9, pathObject: toPath },
    ],
    sampleEvery: 2,
    namePrefix: 'Safe Animation',
  });
  assert.equal(animation.frameCount, 2);

  const camera = await invoke('camera_create', { name: 'Safe Sequence Camera' });
  const sequence = await invoke('camera_sequence_create', {
    layerId: camera.layerId,
    shots: [
      { frame: 0, zoom: 1 },
      { frame: 6, zoom: 1.5 },
      { frame: 12, zoom: 0.8 },
    ],
  });
  assert.equal(sequence.shots.length, 3);
  await invoke('camera_cut', { layerId: camera.layerId, shot: { frame: 2, zoom: 1.1 } });
  await invoke('camera_transition', {
    layerId: camera.layerId,
    from: { frame: 3, zoom: 1.1 },
    to: { frame: 5, zoom: 1.4 },
    easing: 'SlowOut',
  });
  const zoomKeys = await invoke('keyframe_list', { layerId: camera.layerId, attrPath: 'zoom' });
  assert.deepEqual(zoomKeys.keyframes, [0, 2, 3, 5, 6, 12]);

  const risk = await invoke('operation_risk_classify', { operation: 'timeline_play' });
  assert.equal(risk.risk, 'HOST_UNSTABLE');
  const blocked = await invoke('safe_host_operation', { operation: 'timeline_play', params: {} });
  assert.equal(blocked.executed, false);
  assert.equal(blocked.status, 'KNOWN_HOST_LIMITATION');

  // The formerly crashing native entries now fail fast inside the bridge. A
  // rejected tool response is the expected host-limitation result, and bridge
  // health immediately afterward proves no host loss occurred.
  await invoke('path_morph', {
    layerId: path.layerId, attrPath: 'path', startFrame: 0, endFrame: 6, fromPath, toPath,
  }, false);
  await invoke('camera_create_guide', { name: 'Must Not Be Created' }, false);
  await invoke('timeline_play', {}, false);
  const health = await invoke('cavalry_health');
  assert.equal(health.online, true);

  await invoke('scene_save_as', { filePath: scenePath });
  await invoke('scene_open', { path: scenePath, force: true });
  const reopened = await invoke('layer_find', { pattern: 'Safe Morph' });
  assert.ok(reopened.count >= 5);

  const preview = await invoke('timeline_preview_playback', {
    startFrame: 0, endFrame: 2, fps: 30, scalePercentage: 25, outputPath: previewPath,
  });
  assert.equal(preview.format, 'mp4');
  assert.ok((await stat(previewPath)).size > 0);

  const mux = await invoke('render_mux_audio', { videoPath, audioPath, outputPath: muxPath });
  assert.equal(mux.verified, true);
  assert.ok((await stat(muxPath)).size > 0);

  const renderItem = await invoke('render_queue_add');
  const itemId = renderItem.renderQueueItemId;
  await invoke('render_item_set_output', { itemId, filePath: root, fileName: 'supervised-frame', formatType: 'renderPNG' });
  await invoke('render_item_set_range', { itemId, startFrame: 0, endFrame: 0 });
  await invoke('render_start', { itemId });
  const renderStatus = await invoke('render_status', { itemId });
  assert.equal(renderStatus.state, 'COMPLETED');
  const renderActive = await invoke('render_is_active', { itemId });
  assert.equal(renderActive.active, false);
  const renderWait = await invoke('render_wait', { itemId });
  assert.equal(renderWait.completed, true);

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    counts: results.reduce((acc: Record<string, number>, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {}),
    artifacts: { scenePath, previewPath, muxPath },
    results,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ reportPath, counts: report.counts, artifacts: report.artifacts }, null, 2)}\n`);
} finally {
  bridgeClient.stopCallbackServer();
}
