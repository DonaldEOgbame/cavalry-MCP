import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBridgeSandbox, BridgeSandbox } from './support/bridge-sandbox.js';
import { serveBridgeSandbox, HttpBridge } from './support/http-bridge.js';

// The production singletons read their configuration at import time.
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-flow-'));
process.env.CAVALRY_DATA_DIR = dataDirectory;
process.env.CAVALRY_CALLBACK_PORT = '0';

describe('incident and host-state flow through the production client and real bridge.js', () => {
  let sandbox: BridgeSandbox;
  let http: HttpBridge;
  let modules: {
    bridgeClient: typeof import('../../src/bridge/client.js')['bridgeClient'];
    incidentJournal: typeof import('../../src/runtime/incidents.js')['incidentJournal'];
    readIncidentJournal: typeof import('../../src/runtime/incidents.js')['readIncidentJournal'];
    runInToolContext: typeof import('../../src/runtime/context.js')['runInToolContext'];
    probeHost: typeof import('../../src/runtime/host-probe.js')['probeHost'];
  };
  let created = 0;

  before(async () => {
    sandbox = createBridgeSandbox({ getTempFolder: () => os.tmpdir(), create: () => { created += 1; return 'textShape#1'; } });
    http = await serveBridgeSandbox(sandbox);
    process.env.CAVALRY_BRIDGE_PORT = String(http.port);
    const client = await import('../../src/bridge/client.js');
    const incidents = await import('../../src/runtime/incidents.js');
    const context = await import('../../src/runtime/context.js');
    const probe = await import('../../src/runtime/host-probe.js');
    modules = {
      bridgeClient: client.bridgeClient,
      incidentJournal: incidents.incidentJournal,
      readIncidentJournal: incidents.readIncidentJournal,
      runInToolContext: context.runInToolContext,
      probeHost: probe.probeHost,
    };
  });

  after(async () => {
    await modules.bridgeClient.stopCallbackServer();
    await http.close();
    sandbox.cleanup();
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('journals an error raised between requests on the next response', async () => {
    const warmup = await modules.bridgeClient.send('scene_has_unsaved_changes');
    assert.equal(warmup.ok, true);
    sandbox.appCallbacks.onJSError({ name: 'TypeError', message: 'undefined is not an object', stack: 'TypeError: undefined is not an object\n    at userScript (x.js:3:9)' });
    await modules.bridgeClient.send('cavalry_ping');
    const [entry] = modules.incidentJournal.list({ kinds: ['javascript.error'] });
    assert.equal(entry.message, 'undefined is not an object');
    assert.equal(entry.severity, 'error');
    assert.equal(entry.bridge?.firstContext.correlation, 'recent');
    assert.equal(entry.bridge?.firstContext.request?.op, 'scene_has_unsaved_changes', 'status probes are never blamed');
    const persisted = modules.readIncidentJournal(modules.incidentJournal.filePath);
    assert.ok(persisted.some((item) => item.kind === 'javascript.error'), 'journal is persisted to JSONL');
  });

  it('attributes an error raised during a bridge request to the MCP tool call that issued it', async () => {
    sandbox.api.render = () => sandbox.appCallbacks.onJSError('Encoder rejected frame 1811');
    await modules.runInToolContext({ callId: 'call-render-1', tool: 'motion_project_render', startedAt: Date.now() }, () => modules.bridgeClient.send('render_start', { itemId: 'renderItem#9', jobId: 'job-9' }));
    const [entry] = modules.incidentJournal.list({ callId: 'call-render-1' });
    assert.equal(entry.message, 'Encoder rejected frame 1811');
    assert.equal(entry.toolCall?.tool, 'motion_project_render');
    assert.equal(entry.toolCall?.op, 'render_start');
    assert.equal(entry.bridge?.firstContext.host.activeRender && (entry.bridge.firstContext.host.activeRender as any).jobId, 'job-9');
  });

  it('classifies a responsive bridge as idle and exposes the session audit', async () => {
    const host = await modules.probeHost();
    assert.equal(host.state, 'idle');
    assert.equal(host.confidence, 'confirmed');
    const sessions = host.bridgeStatus?.sessions ?? [];
    assert.deepEqual(sessions.map((session) => session.sessionId), [modules.bridgeClient.sessionIdentifier]);
  });

  it('classifies a silent script host as busy, then wedged, then error-dialog, and never executes expired work', async () => {
    modules.incidentJournal.reset();
    http.blocked = true;
    const pending = modules.bridgeClient.send('layer_create', { layerType: 'textShape' }, 1_200).catch((error) => error);
    const busy = await modules.probeHost({ statusTimeoutMs: 300 });
    assert.equal(busy.state, 'busy');
    assert.equal(busy.confidence, 'inferred');
    const timedOut = await pending;
    assert.equal(timedOut.code, 'BRIDGE_TIMEOUT');

    const wedged = await modules.probeHost({ statusTimeoutMs: 300 });
    assert.equal(wedged.state, 'wedged');
    assert.equal(wedged.recoveryRecommended, true);

    modules.incidentJournal.ingest([{
      incidentId: 'inc_dialog', kind: 'javascript.error', source: 'onJSError', fingerprint: 'f', count: 1, updatedSeq: 1,
      error: { name: 'Error', message: 'Uncaught exception', stack: '' }, firstSeen: Date.now(), lastSeen: Date.now(),
      firstContext: { at: Date.now(), correlation: 'none', request: null, host: {} }, lastContext: { at: Date.now(), correlation: 'none', request: null, host: {} },
    }], 'bridge_synthetic');
    const dialog = await modules.probeHost({ statusTimeoutMs: 300 });
    assert.equal(dialog.state, 'error_dialog_active');

    http.blocked = false;
    const recovered = await modules.probeHost();
    assert.equal(recovered.state, 'idle');
    assert.equal(created, 0, 'a request that expired while the host was blocked must not run later');
  });
});
