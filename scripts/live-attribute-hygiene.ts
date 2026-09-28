#!/usr/bin/env node
/**
 * Live node-type attribute hygiene test (requires Cavalry + bridge).
 *
 * For each important node type: create → inspect → mutate supported
 * properties → verify → inspect again (summary, detailed, targeted), with
 * change events subscribed. Passes only if the bridge reports zero rejected
 * reads and (when --cavalry-log/CAVALRY_LOG_PATH is given) Cavalry's own log
 * gains zero "Attribute not found" lines over the run.
 *
 *   npm run build && tsx scripts/live-attribute-hygiene.ts [--cavalry-log <path>]
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { argument, McpHarness, stamp, writeEvidence } from './lib/mcp-harness.js';
import { closeHostLogWindow, counterDelta, openHostLogWindow } from './lib/host-log.js';

const evidenceDirectory = path.resolve(argument('--output', path.join('coverage', 'reliability', `attribute-hygiene-${stamp()}`))!);
const harness = await McpHarness.start({ evidenceDirectory, profile: 'standard', clientName: 'cavalry-attribute-hygiene' });
const log = openHostLogWindow(argument('--cavalry-log') ?? process.env.CAVALRY_LOG_PATH);
const steps: Array<{ nodeType: string; step: string; ok: boolean; detail?: unknown }> = [];
const record = (nodeType: string, step: string, ok: boolean, detail?: unknown) => steps.push({ nodeType, step, ok, ...(detail !== undefined ? { detail } : {}) });

try {
  const before = (await harness.expect('cavalry_health')).attributeHygiene;
  assert.ok(before, 'Installed bridge does not report attribute metrics; reinstall cavalry/bridge.js from this checkout.');
  await harness.expect('scene_new', { force: true });
  const comp = await harness.expect('composition_create', { name: 'Attribute Hygiene', width: 1280, height: 720, fps: 30, startFrame: 0, endFrame: 89, makeActive: true });
  record('composition', 'create', Boolean(comp.compId));
  await harness.expect('events_subscribe', { events: ['*'] });

  const layers: Array<{ nodeType: string; tool: string; args: Record<string, unknown>; set: Record<string, unknown> }> = [
    { nodeType: 'textShape', tool: 'layer_create', args: { layerType: 'textShape', name: 'Hygiene Text' }, set: { position: { x: 10, y: 20 }, opacity: 80, fontSize: 64, text: { text: 'HYGIENE', overrides: [] } } },
    { nodeType: 'basicShape (rectangle)', tool: 'layer_create_primitive', args: { primitiveType: 'rectangle', name: 'Hygiene Rectangle' }, set: { position: { x: -40, y: 5 }, opacity: 60, 'generator.dimensions': { x: 200, y: 80 } } },
    { nodeType: 'basicShape (ellipse)', tool: 'layer_create_primitive', args: { primitiveType: 'ellipse', name: 'Hygiene Ellipse' }, set: { position: { x: 40, y: -5 }, opacity: 70 } },
    { nodeType: 'group', tool: 'layer_create', args: { layerType: 'group', name: 'Hygiene Group' }, set: { position: { x: 0, y: 0 }, opacity: 100 } },
  ];
  for (const layer of layers) {
    const created = await harness.expect(layer.tool, layer.args);
    const layerId = created.layerId as string;
    record(layer.nodeType, 'create', Boolean(layerId), { layerId, uuid: created.uuid });
    // UUID support is decided per node type by the capability registry;
    // ordinary layers must still resolve to a UUID (identity regression guard).
    record(layer.nodeType, 'identity has uuid', typeof created.uuid === 'string' && created.uuid.length > 0, created.uuid);
    record(layer.nodeType, 'inspect', (await harness.call('layer_inspect', { layerId })).ok);
    record(layer.nodeType, 'mutate', (await harness.call('attribute_set_many', { layerId, attributes: layer.set })).ok);
    const position = await harness.call('attribute_get', { layerId, attrPath: 'position' });
    record(layer.nodeType, 'verify', position.ok && (position.payload as any)?.value?.x === (layer.set.position as any).x, position.payload);
    const keyed = await harness.call('keyframe_create', { layerId, attrPath: 'opacity', frame: 0, value: 0 });
    const keyedEnd = await harness.call('keyframe_create', { layerId, attrPath: 'opacity', frame: 30, value: layer.set.opacity });
    record(layer.nodeType, 'keyframes', keyed.ok && keyedEnd.ok);
    const missing = await harness.call('attribute_get', { layerId, attrPath: 'gradient.0.color' });
    record(layer.nodeType, 'unsupported attribute answered without a host read', !missing.ok && missing.errorCode === 'ATTRIBUTE_NOT_FOUND', missing.error);
  }

  const marker = await harness.call('marker_create', { frame: 15, label: 'hygiene' });
  record('timeMarker', 'create', marker.ok);
  record('timeMarker', 'list', (await harness.call('marker_list')).ok);

  const item = await harness.call('render_queue_add', { compId: comp.compId });
  const itemId = (item.payload as any)?.renderQueueItemId;
  record('renderQueueItem', 'create', item.ok && Boolean(itemId));
  if (itemId) {
    record('renderQueueItem', 'inspect (enumerated)', (await harness.call('render_item_inspect', { itemId })).ok);
    const targeted = await harness.call('render_item_inspect', { itemId, attributes: ['fileName', 'frameRange'] });
    record('renderQueueItem', 'inspect (targeted)', targeted.ok, (targeted.payload as any)?.unsupported);
    record('renderQueueItem', 'delete', (await harness.call('render_item_delete', { itemId })).ok);
  }

  for (const mode of ['summary', 'detailed', 'targeted'] as const) {
    const inspected = await harness.call('scene_inspect', mode === 'targeted' ? { mode, attributes: ['position', 'opacity', 'text', 'generator.dimensions'] } : { mode });
    record('scene', `inspect ${mode}`, inspected.ok);
  }
  record('events', 'poll', (await harness.call('events_poll', { limit: 500 })).ok);
  await harness.call('events_unsubscribe', { events: ['*'] });

  const after = (await harness.expect('cavalry_health')).attributeHygiene;
  const delta = counterDelta(before, after);
  const hostLog = closeHostLogWindow(log);
  const failedSteps = steps.filter((step) => !step.ok);
  const report = {
    kind: 'live-attribute-hygiene',
    generatedAt: new Date().toISOString(),
    status: failedSteps.length === 0 && delta?.invalidAttributeReads === 0 && (!hostLog || hostLog.attributeNotFound === 0) ? 'PASS' : 'FAIL',
    attributeMetricsDelta: delta,
    cavalryLog: hostLog ?? { captured: false },
    failedSteps,
    steps,
    calls: harness.calls,
  };
  writeEvidence(evidenceDirectory, 'attribute-hygiene.json', report);
  process.stdout.write(`${JSON.stringify({ status: report.status, invalidAttributeReads: delta?.invalidAttributeReads, cavalryLogAttributeNotFound: hostLog?.attributeNotFound ?? 'not captured', failedSteps: failedSteps.length, evidence: evidenceDirectory }, null, 2)}\n`);
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  await harness.close();
}
