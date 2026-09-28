import assert from 'node:assert/strict';
import { bridgeClient } from '../src/bridge/client.js';
import * as Comp from '../src/cavalry/compositions.js';
import { executeBatch } from '../src/cavalry/capabilities.js';

const count = Number(process.env.CAVALRY_LARGE_SCENE_LAYERS ?? 1000);
const chunkSize = Number(process.env.CAVALRY_LARGE_SCENE_BATCH ?? 25);
const resume = process.env.CAVALRY_LARGE_SCENE_RESUME === 'true';
let existing = 0;
if (resume) {
  const listing = (await bridgeClient.send<any>('layer_list', { allScene: true }, 120_000)).result;
  existing = listing.layers.filter((layer: any) => layer.name?.startsWith('Stress ')).length;
  process.stdout.write(`Resuming from ${existing}/${count} layers.\n`);
} else {
  await bridgeClient.send('scene_new', { force: true }, 60_000);
  await Comp.compositionCreate({ name: 'MCP Large Scene Stress', width: 640, height: 360, fps: 30, startFrame: 0, endFrame: 60 });
}
const started = Date.now();
for (let offset = existing; offset < count; offset += chunkSize) {
  const operations = Array.from({ length: Math.min(chunkSize, count - offset) }, (_, index) => ({
    id: `layer-${offset + index}`,
    op: 'layer_create_primitive',
    params: { primitiveType: 'rectangle', name: `Stress ${offset + index}` },
  }));
  // Avoid serialising an ever-growing scene before every construction chunk;
  // rollback is exercised separately below with a single checkpoint.
  const result = await executeBatch({ operations, transactional: false, verify: true, operationTimeoutMs: 120_000 });
  assert.equal(result.allOk, true);
  if ((offset + operations.length) % 100 === 0 || offset + operations.length === count) {
    process.stdout.write(`Created ${offset + operations.length}/${count} layers.\n`);
  }
}
const beforeRollback = ((await bridgeClient.send<any>('layer_list', {}, 120_000)).result?.layers ?? []).length;
const rollback = await executeBatch({
  operations: [
    { id: 'temporary', op: 'layer_create_primitive', params: { primitiveType: 'ellipse', name: 'Must Roll Back' } },
    { id: 'forced-failure', op: 'operation_that_does_not_exist', params: {} },
  ],
  transactional: true,
  stopOnError: true,
  operationTimeoutMs: 120_000,
});
assert.equal(rollback.allOk, false);
assert.equal(rollback.rolledBack, true);
assert.equal(((await bridgeClient.send<any>('layer_list', {}, 120_000)).result?.layers ?? []).length, beforeRollback);
process.stdout.write(`PASS ${count} layers plus transactional rollback in ${Date.now() - started}ms.\n`);
await bridgeClient.send('scene_new', { force: true }, 60_000);
await bridgeClient.stopCallbackServer();
