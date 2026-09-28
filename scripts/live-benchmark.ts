import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { bridgeClient } from '../src/bridge/client.js';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Render from '../src/cavalry/rendering.js';
import { executeBatch } from '../src/cavalry/capabilities.js';

const timings: Record<string, number> = {};
async function measure(name: string, operation: () => Promise<unknown>) {
  const started = performance.now();
  const result = await operation();
  timings[name] = Number((performance.now() - started).toFixed(2));
  return result;
}

await measure('pingMs', () => bridgeClient.send('cavalry_ping'));
await Scene.sceneNew(true);
await Comp.compositionCreate({ name: 'MCP Benchmark', width: 320, height: 180, fps: 30, startFrame: 0, endFrame: 30 });
const layer = await measure('createLayerMs', () => Layer.layerCreatePrimitive('rectangle', 'Benchmark Rectangle')) as any;
await measure('batch10MutationsMs', () => executeBatch({
  transactional: true,
  operations: Array.from({ length: 10 }, (_, index) => ({ id: `set-${index}`, op: 'attribute_set', params: { layerId: layer.layerId, attrPath: 'position.x', value: index * 10 } })),
}));
await measure('sceneInspectionMs', () => Scene.sceneInspect(true));
const target = path.join(os.tmpdir(), `cavalry-benchmark-${process.pid}.cv`);
await measure('sceneSaveMs', () => Scene.sceneSaveAs(target));
await measure('renderSubmissionMs', () => Render.renderQueueAdd());
assert.ok(fs.existsSync(target));
fs.unlinkSync(target);
await Scene.sceneNew(true);
await bridgeClient.stopCallbackServer();

const limits = { pingMs: 1000, createLayerMs: 3000, batch10MutationsMs: 10_000, sceneInspectionMs: 5000, sceneSaveMs: 10_000, renderSubmissionMs: 3000 };
for (const [name, limit] of Object.entries(limits)) assert.ok(timings[name] <= limit, `${name} ${timings[name]}ms exceeds ${limit}ms`);
process.stdout.write(`${JSON.stringify({ cavalryVersion: '2.7.2', timings, thresholdsMs: limits }, null, 2)}\n`);
