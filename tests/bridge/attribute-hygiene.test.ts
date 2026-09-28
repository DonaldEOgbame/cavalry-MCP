import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBridgeSandbox, BridgeSandbox } from './support/bridge-sandbox.js';
import { createCavalryModel, CavalryModel } from './support/cavalry-model.js';
import { runProductionWorkload } from './support/production-workload.js';

const source = fs.readFileSync(path.resolve('cavalry/bridge.js'), 'utf8');

describe('attribute hygiene: the bridge never asks Cavalry invalid questions', () => {
  let sandbox: BridgeSandbox | undefined;
  let model: CavalryModel;
  afterEach(() => sandbox?.cleanup());
  const start = () => {
    model = createCavalryModel();
    sandbox = createBridgeSandbox({}, { host: model });
    return sandbox;
  };
  const metrics = () => sandbox!.send('bridge_status').result.attributes;

  it('runs the full 55-scene compile/verify/correct workload with zero "Attribute not found" host errors', () => {
    const box = start();
    const workload = runProductionWorkload(box);
    assert.equal(workload.layersCreated, 138);
    assert.equal(workload.keyframesCreated, 2095);
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
    const counters = metrics();
    assert.equal(counters.invalidAttributeReads, 0);
    assert.ok(counters.attributeEnumerations <= 4, `one enumeration per node type, got ${counters.attributeEnumerations}`);
    assert.ok(counters.uuidLookups <= 139, 'at most one uuid read per object');
    assert.ok(counters.eventNotificationsWithoutReads > 10_000, 'notifications still flow without reads');
    assert.equal(counters.eventEnrichmentReads, 0);
  });

  it('stays clean when a client subscribes to every event', () => {
    const box = start();
    runProductionWorkload(box, { subscribeEvents: true });
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
    // Notifications on curves, markers and pseudo paths outside batches.
    box.send('events_clear', {});
    const layerId = model.api.getAllSceneLayers().find((id: string) => model.typeOf(id) === 'textShape');
    for (const attribute of ['out', 'time', 'keyframes.3', 'gradient.0', 'position']) box.appCallbacks.onAttrChanged(layerId, attribute);
    const curve = model.api.createTimeMarker();
    box.appCallbacks.onAttrChanged(curve, 'time');
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
    const events = box.send('events_poll', { limit: 1000 }).result.events;
    const enriched = events.find((event: any) => event.event === 'attribute.changed' && event.attribute === 'position' && event.layerId === layerId);
    assert.ok(enriched && 'value' in enriched, 'readable attributes are still enriched for subscribers');
    const pseudo = events.find((event: any) => event.attribute === 'out' && event.layerId === layerId);
    assert.equal(pseudo && 'value' in pseudo, false);
  });

  it('resolves identity without reading uuid from objects that have none', () => {
    const box = start();
    box.send('scene_new', {});
    const marker = box.send('marker_create', { frame: 10, label: 'beat', color: '#7c3aed' });
    assert.equal(marker.ok, true);
    assert.deepEqual(marker.result.unsupported, ['color']);
    const listed = box.send('marker_list', {});
    assert.equal(listed.ok, true);
    assert.equal(listed.result.markers[0].time, 10, 'marker time comes from dedicated marker state, not api.get');
    const curveLayer = model.api.create('textShape', 'curve owner');
    model.api.keyframe(curveLayer, 0, { opacity: 0 });
    const status = box.send('bridge_status').result;
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
    assert.equal(status.capabilities.types.find((item: any) => item.type === 'timeMarker')?.uuid ?? false, false);
  });

  it('answers a client read of a missing attribute with ATTRIBUTE_NOT_FOUND without calling Cavalry', () => {
    const box = start();
    box.send('scene_new', {});
    const layerId = box.send('layer_create', { layerType: 'textShape', name: 'Title' }).result.layerId;
    const missing = box.send('attribute_get', { layerId, attrPath: 'gradient.0.color' });
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, 'ATTRIBUTE_NOT_FOUND');
    assert.equal(missing.error.incidentId, undefined, 'an avoided read is not a host incident');
    const present = box.send('attribute_get', { layerId, attrPath: 'position.x' });
    assert.equal(present.ok, true, 'non-enumerated child paths are confirmed on the instance');
    const many = box.send('attribute_get_many', { layerId, attrPaths: ['opacity', 'out', 'stroke.width'] }).result;
    assert.deepEqual(many.unsupported, ['out', 'stroke.width']);
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
  });

  it('supports summary, detailed and targeted inspection without unsupported reads', () => {
    const box = start();
    runProductionWorkload(box);
    const summary = box.send('scene_inspect', { mode: 'summary' }).result;
    assert.equal(summary.layers[0].transforms, undefined);
    const detailed = box.send('scene_inspect', { mode: 'detailed' }).result;
    assert.ok(detailed.layers.some((layer: any) => layer.transforms && 'position' in layer.transforms));
    const targeted = box.send('scene_inspect', { mode: 'targeted', attributes: ['text', 'generator.dimensions'] }).result;
    const text = targeted.layers.find((layer: any) => layer.type === 'textShape');
    assert.ok('text' in text.values);
    assert.deepEqual(text.unsupported, ['generator.dimensions']);
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
    const counters = metrics();
    assert.equal(counters.detailedInspections, 1);
    assert.equal(counters.targetedInspections, 1);
  });

  it('confirms targeted attributes per instance when one node type has multiple generators', () => {
    const box = start();
    box.send('scene_new', {});
    box.send('composition_create', { name: 'Comp', width: 1280, height: 720, fps: 30, startFrame: 0, endFrame: 30, makeActive: true });
    const rectangle = box.send('layer_create_primitive', { primitiveType: 'rectangle', name: 'Rectangle' }).result.layerId;
    const ellipse = box.send('layer_create_primitive', { primitiveType: 'ellipse', name: 'Ellipse' }).result.layerId;
    const inspected = box.send('scene_inspect', { mode: 'targeted', attributes: ['generator.dimensions'] }).result;
    assert.ok('generator.dimensions' in inspected.layers.find((layer: any) => layer.layerId === rectangle).values);
    assert.deepEqual(inspected.layers.find((layer: any) => layer.layerId === ellipse).unsupported, ['generator.dimensions']);
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
  });

  it('still catches a mutation Cavalry did not apply as requested', () => {
    const box = start();
    box.send('scene_new', {});
    const set = model.api.set;
    // Simulate the host clamping a value: the write "succeeds" but reads back differently.
    box.api.set = (id: string, updates: Record<string, unknown>) => set(id, Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, key === 'opacity' ? 50 : value])));
    const result = box.send('batch', { operations: [
      { id: 'create', op: 'layer_create', params: { layerType: 'textShape', name: 'T' }, saveAs: '$t' },
      { id: 'set', op: 'attribute_set_many', params: { layerId: '$t', attributes: { opacity: 100, position: { x: 1, y: 2 } } } },
    ], transactional: false, verify: true }).result;
    assert.equal(result.allOk, false);
    const failed = result.stepResults.find((step: any) => !step.ok);
    assert.equal(failed.id, 'set');
    assert.match(failed.error.message, /POSTCONDITION_FAILED: attribute readback mismatch for opacity/);
    assert.equal(model.log.attributeNotFound, 0);
  });

  it('reads only enumerated attributes when inspecting a render item, or exactly the targeted ones', () => {
    const box = start();
    box.send('scene_new', {});
    const item = model.api.addRenderQueueItem();
    const all = box.send('render_item_inspect', { itemId: item }).result;
    assert.deepEqual(Object.keys(all.values).sort(), ['fileName', 'filePath', 'frameRange', 'frameRangeMode', 'metadata']);
    const targeted = box.send('render_item_inspect', { itemId: item, attributes: ['fileName', 'uuid'] }).result;
    assert.deepEqual(Object.keys(targeted.values), ['fileName']);
    assert.deepEqual(targeted.unsupported, ['uuid']);
    assert.equal(model.log.attributeNotFound, 0, JSON.stringify([...model.log.byFamily]));
  });

  it('counts, categorizes and surfaces a read the registry wrongly allowed, instead of hiding it', () => {
    const box = start();
    box.send('scene_new', {});
    const layerId = box.send('layer_create', { layerType: 'textShape', name: 'T' }).result.layerId;
    // The node claims an attribute it cannot actually return.
    const hasAttribute = model.api.hasAttribute;
    box.api.hasAttribute = (id: string, attr: string) => attr === 'phantom' || hasAttribute(id, attr);
    const response = box.send('attribute_get', { layerId, attrPath: 'phantom' });
    assert.equal(response.ok, false);
    assert.equal(metrics().invalidAttributeReads, 1);
    const [incident] = box.send('diagnostics_incidents', { kinds: ['attribute.invalid_read'] }).result.incidents;
    assert.equal(incident.category, 'invalid_attribute');
    assert.equal(incident.lastContext.attrPath, 'phantom');
  });
});

describe('attribute hygiene: offline contract on bridge.js', () => {
  it('issues every attribute read through the capability-checked readAttr path', () => {
    const reads = source.match(/api\.get\(/g) ?? [];
    assert.equal(reads.length, 1, 'the only api.get call lives inside readAttr');
    assert.match(source, /function readAttr\(layerId, path, mode\) \{[\s\S]*?api\.get\(layerId, path\)/);
  });

  it('never reads identity or values unconditionally from change notifications', () => {
    const callback = source.slice(source.indexOf('this.onAttrChanged'), source.indexOf('this.onAssetAdded'));
    assert.match(callback, /const subscribed = eventSubscriptions\["\*"\] \|\| eventSubscriptions\["attribute\.changed"\]/);
    assert.match(callback, /subscribed && !activeRender && !batchExecution/);
    assert.doesNotMatch(callback, /getLayerIdentity\(/);
    const layerAdded = source.slice(source.indexOf('this.onLayerAdded'), source.indexOf('this.onLayerRemoved'));
    assert.doesNotMatch(layerAdded, /getLayerIdentity\(/);
  });

  it('decides uuid support per node type, never by reading uuid and catching the failure', () => {
    const identity = source.slice(source.indexOf('function getLayerIdentity'), source.indexOf('function getCallbackTarget'));
    assert.match(identity, /layerUuid\(actualId\)/);
    assert.doesNotMatch(identity, /"uuid"/);
    assert.match(source, /LAYER_ID_IDENTITY_TYPES = \{ animationCurve: true, timeMarker: true/);
    assert.match(source, /api\.getAllSceneLayers\(\)/);
  });

  it('keys the capability cache by Cavalry version and node type', () => {
    assert.match(source, /const key = cavalryVersionKey\(\) \+ "\|" \+ type;/);
  });
});
