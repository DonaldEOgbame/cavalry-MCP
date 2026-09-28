import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeSandbox, BridgeSandbox } from './support/bridge-sandbox.js';

describe('bridge runtime reliability (real bridge.js in a VM)', () => {
  let sandbox: BridgeSandbox | undefined;
  afterEach(() => sandbox?.cleanup());

  it('turns an exception inside a native application callback into an incident instead of escaping', () => {
    sandbox = createBridgeSandbox({ getSelection: () => { throw new TypeError('getSelection is not a function'); } });
    assert.doesNotThrow(() => sandbox!.appCallbacks.onSelectionChanged());
    const listed = sandbox.send('diagnostics_incidents', {});
    assert.equal(listed.ok, true);
    const [incident] = listed.result.incidents;
    assert.equal(incident.kind, 'callback.exception');
    assert.equal(incident.source, 'app.onSelectionChanged');
    assert.equal(incident.error.name, 'TypeError');
    assert.match(incident.error.stack, /getSelection is not a function/);
  });

  it('correlates a Cavalry-reported JavaScript error with the active request, render item, and host state', () => {
    sandbox = createBridgeSandbox();
    const box = sandbox;
    box.api.getAttributes = () => ['filePath', 'fileName', 'frameRange', 'frameRangeMode'];
    box.api.get = (_id: string, attr: string) => (attr === 'frameRange' ? { x: 0, y: 3120 } : attr === 'fileName' ? 'film' : undefined);
    box.api.render = () => { box.appCallbacks.onJSError({ name: 'Error', message: 'Render worker failed', stack: 'Error: Render worker failed\n    at encoder (render.js:10:2)' }); };
    const rendered = box.send('render_start', { itemId: 'renderItem#4', jobId: 'job-1' });
    assert.equal(rendered.ok, true);
    assert.equal(typeof rendered.result.nativeCallMs, 'number');
    const incident = box.send('diagnostics_incidents', { kinds: ['javascript.error'] }).result.incidents[0];
    assert.equal(incident.firstContext.correlation, 'active');
    assert.equal(incident.firstContext.request.op, 'render_start');
    assert.equal(incident.firstContext.request.requestId, rendered.id);
    assert.equal(incident.firstContext.host.activeRender.itemId, 'renderItem#4');
    assert.equal(incident.firstContext.host.activeRender.jobId, 'job-1');
    assert.deepEqual(incident.firstContext.host.activeRender.settings.frameRange, { x: 0, y: 3120 });
    assert.equal(typeof incident.firstContext.host.sceneRevision, 'number');
  });

  it('deduplicates repeated errors by fingerprint and counts occurrences', () => {
    sandbox = createBridgeSandbox();
    for (let index = 0; index < 5; index += 1) sandbox.appCallbacks.onJSError(`Layer basicShape#${index + 100} is missing`);
    const incidents = sandbox.send('diagnostics_incidents', {}).result.incidents;
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].count, 5);
  });

  it('answers status probes re-entrantly during a render and defers scene operations until it returns', () => {
    sandbox = createBridgeSandbox();
    const box = sandbox;
    const order: string[] = [];
    let probe: any;
    let inspect: any;
    box.api.getAllSceneLayers = () => { order.push('scene_inspect'); return []; };
    box.api.render = () => {
      order.push('render:start');
      // Simulate Cavalry pumping its event loop from inside api.render().
      probe = box.request('bridge_status');
      inspect = box.request('scene_inspect');
      box.post(inspect);
      box.post(probe);
      box.tick();
      assert.equal(box.responseFor(inspect.id), undefined, 'scene operation must not run inside the render');
      const status = box.responseFor(probe.id);
      assert.equal(status.ok, true);
      assert.equal(status.result.busy, true);
      assert.equal(status.result.activeRender.itemId, 'renderItem#1');
      assert.equal(status.result.activeRequest.op, 'render_start');
      assert.equal(status.result.deferredPosts, 1);
      order.push('render:end');
    };
    const rendered = box.send('render_start', { itemId: 'renderItem#1' });
    assert.equal(rendered.ok, true);
    assert.equal(box.responseFor(inspect.id).ok, true);
    assert.deepEqual(order, ['render:start', 'render:end', 'scene_inspect']);
    const after = box.send('bridge_status');
    assert.equal(after.result.busy, false);
    assert.equal(after.result.activeRequest, null);
    assert.equal(after.result.lastRender.itemId, 'renderItem#1');
    assert.equal(after.result.deferredTotal, 1);
  });

  it('does not execute a request whose client deadline passed while the host was busy', () => {
    sandbox = createBridgeSandbox();
    let created = 0;
    sandbox.api.create = () => { created += 1; return 'textShape#1'; };
    const expired = sandbox.send('layer_create', { layerType: 'textShape' }, { deadlineAt: Date.now() - 1 });
    assert.equal(expired.ok, false);
    assert.equal(expired.error.code, 'REQUEST_EXPIRED');
    assert.equal(created, 0);
  });

  it('returns structured handler errors with stack and incident id', () => {
    sandbox = createBridgeSandbox({ openScene: () => { throw new Error('Scene file is corrupt'); } });
    const failed = sandbox.send('scene_open', { path: '/tmp/x.cv' });
    assert.equal(failed.ok, false);
    assert.equal(failed.error.code, 'CAVALRY_ERROR');
    assert.match(failed.error.stack, /Scene file is corrupt/);
    assert.match(failed.error.incidentId, /^inc_/);
  });

  it('piggybacks unacknowledged incidents on responses when the client sends an ack cursor', () => {
    sandbox = createBridgeSandbox();
    sandbox.appCallbacks.onJSError('first failure');
    const withAck = sandbox.send('cavalry_ping', {}, { ackIncidentSeq: 0 });
    assert.equal(withAck.incidentSeq >= 1, true);
    assert.equal(withAck.incidents.length, 1);
    const acknowledged = sandbox.send('cavalry_ping', {}, { ackIncidentSeq: withAck.incidentSeq });
    assert.equal(acknowledged.incidents, undefined);
    const legacy = sandbox.send('cavalry_ping');
    assert.equal(legacy.incidents, undefined, 'clients without an ack cursor keep the old payload');
  });

  it('audits bridge sessions so a bypassing client is visible', () => {
    sandbox = createBridgeSandbox();
    sandbox.send('cavalry_ping');
    sandbox.send('scene_inspect');
    const status = sandbox.send('bridge_status').result;
    assert.equal(status.sessions.length, 1);
    assert.equal(status.sessions[0].requests, 3);
    assert.equal(status.sessions[0].rawScriptRequests, 0);
    sandbox.post({ protocolVersion: 2, id: 'req_bogus', sessionId: 'nope', token: 'x', op: 'scene_inspect', timestamp: Date.now() });
    sandbox.pump();
    assert.equal(sandbox.send('bridge_status').result.rejectedUnauthenticated, 1);
  });

  it('guards the transport timer so a failing post loop cannot raise a dialog', () => {
    sandbox = createBridgeSandbox();
    const box = sandbox;
    const original = box.api.getTempFolder;
    box.api.getTempFolder = () => { throw new Error('temp folder unavailable'); };
    box.post(box.request('cavalry_ping'));
    assert.doesNotThrow(() => box.tick());
    box.api.getTempFolder = original;
  });
});
