import assert from 'node:assert/strict';
import { bridgeClient } from '../src/bridge/client.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import { executeBatch } from '../src/cavalry/capabilities.js';

const count = Number(process.env.CAVALRY_LARGE_SCENE_KEYFRAMES ?? 2000);
const chunkSize = Number(process.env.CAVALRY_KEYFRAME_STRESS_BATCH ?? 100);
const resume = process.env.CAVALRY_KEYFRAME_STRESS_RESUME === 'true';
let layer: any;
let existing = 0;
if (resume) {
  layer = ((await bridgeClient.send<any>('layer_find', { pattern: 'Keyframe Stress Target' }, 120_000)).result?.layers ?? [])[0];
  assert.ok(layer?.layerId, 'No keyframe stress scene is available to resume.');
  existing = ((await bridgeClient.send<any>('keyframe_list', { layerId: layer.layerId, attrPath: 'position.x' }, 120_000)).result?.keyframes ?? []).length;
  process.stdout.write(`Resuming from ${existing}/${count} keyframes.\n`);
} else {
  await bridgeClient.send('scene_new', { force: true }, 60_000);
  await Comp.compositionCreate({ name: 'MCP Keyframe Stress', width: 320, height: 180, fps: 30, startFrame: 0, endFrame: count });
  layer = await Layer.layerCreatePrimitive('rectangle', 'Keyframe Stress Target');
}
const started = Date.now();
for (let offset = existing; offset < count; offset += chunkSize) {
  const operations = Array.from({ length: Math.min(chunkSize, count - offset) }, (_, index) => ({
    id: `key-${offset + index}`,
    op: 'keyframe_create',
    params: { layerId: layer.layerId, attrPath: 'position.x', frame: offset + index, value: (offset + index) % 320 },
  }));
  const result = await executeBatch({ operations, transactional: false, verify: true, operationTimeoutMs: 120_000 });
  assert.equal(result.allOk, true);
  if ((offset + operations.length) % 500 === 0 || offset + operations.length === count) process.stdout.write(`Created ${offset + operations.length}/${count} keyframes.\n`);
}
const frames = (await bridgeClient.send<any>('keyframe_list', { layerId: layer.layerId, attrPath: 'position.x' }, 120_000)).result;
assert.equal(frames.keyframes.length, count);
process.stdout.write(`PASS ${count} verified keyframes in ${Date.now() - started}ms.\n`);
await bridgeClient.send('scene_new', { force: true }, 60_000);
await bridgeClient.stopCallbackServer();
