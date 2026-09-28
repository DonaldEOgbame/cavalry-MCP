import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHostState, HostSignals } from '../../src/runtime/host-state.js';
import type { BridgeStatus } from '../../src/bridge/protocol.js';

const NOW = 1_000_000;

function status(overrides: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    bridgeVersion: '1.0.0', protocolVersion: 2, bridgeCapabilities: [], bridgeInstanceId: 'bridge_1', now: NOW,
    busy: false, activeRequest: null, lastCompletedRequest: null, activeRender: null, lastRender: null,
    deferredPosts: 0, deferredTotal: 0, appState: 'active', sceneRevision: 1, incidentSeq: 0, incidentCount: 0,
    lastIncidentAt: null, sessions: [], rejectedUnauthenticated: 0, rejectedMalformed: 0, ...overrides,
  };
}

function signals(overrides: Partial<HostSignals> = {}): HostSignals {
  return {
    now: NOW,
    processRunning: true,
    transportReachable: true,
    statusProbe: { ok: true, latencyMs: 5, status: status() },
    errorDialogVisible: null,
    inFlight: [],
    supervisedRenders: [],
    dialogClassIncidentTimes: [],
    lastScriptResponseAt: NOW - 1_000,
    ...overrides,
  };
}

const silent = { ok: false as const, latencyMs: 3_000, failure: 'timeout' as const };

describe('host state classification', () => {
  it('reports idle only when the bridge answers with nothing active', () => {
    const result = classifyHostState(signals());
    assert.equal(result.state, 'idle');
    assert.equal(result.confidence, 'confirmed');
    assert.equal(result.ready, true);
  });

  it('separates a missing process from a disconnected bridge', () => {
    assert.equal(classifyHostState(signals({ transportReachable: false, processRunning: false })).state, 'cavalry_not_running');
    const disconnected = classifyHostState(signals({ transportReachable: false, processRunning: true }));
    assert.equal(disconnected.state, 'bridge_disconnected');
    assert.equal(disconnected.confidence, 'confirmed');
    assert.equal(disconnected.recoveryRecommended, true);
    assert.equal(classifyHostState(signals({ transportReachable: false, processRunning: null })).confidence, 'inferred');
  });

  it('reports rendering from the bridge and busy for other active work', () => {
    const rendering = classifyHostState(signals({ statusProbe: { ok: true, latencyMs: 2, status: status({ busy: true, activeRender: { itemId: 'renderItem#1', startedAt: NOW - 10_000, ageMs: 10_000 } }) } }));
    assert.equal(rendering.state, 'rendering');
    assert.equal(rendering.ready, false);
    assert.equal(rendering.recoveryRecommended, false);
    const busy = classifyHostState(signals({ statusProbe: { ok: true, latencyMs: 2, status: status({ busy: true, activeRequest: { requestId: 'r', sessionId: 's', op: 'batch', startedAt: NOW - 5_000, ageMs: 5_000 } }) } }));
    assert.equal(busy.state, 'busy');
  });

  it('calls a long-running operation wedged', () => {
    const result = classifyHostState(signals({ statusProbe: { ok: true, latencyMs: 2, status: status({ busy: true, activeRequest: { requestId: 'r', sessionId: 's', op: 'scene_open', startedAt: NOW - 600_000, ageMs: 600_000 } }) } }));
    assert.equal(result.state, 'wedged');
    assert.equal(result.recoveryRecommended, true);
  });

  it('calls a render with no output progress past its stall window wedged, even while the bridge answers', () => {
    const result = classifyHostState(signals({ supervisedRenders: [{ jobId: 'job', startedAt: NOW - 400_000, lastProgressAt: NOW - 200_000, stallAfterMs: 120_000 }] }));
    assert.equal(result.state, 'wedged');
    assert.match(result.reasons[0], /no output progress/);
  });

  it('trusts a confirmed dialog probe over everything except a dead transport', () => {
    assert.equal(classifyHostState(signals({ errorDialogVisible: true })).state, 'error_dialog_active');
    assert.equal(classifyHostState(signals({ errorDialogVisible: true, transportReachable: false })).state, 'bridge_disconnected');
  });

  it('infers an error dialog when the script host went silent right after a JavaScript error', () => {
    const result = classifyHostState(signals({ statusProbe: silent, dialogClassIncidentTimes: [NOW - 2_000], lastScriptResponseAt: NOW - 1_500 }));
    assert.equal(result.state, 'error_dialog_active');
    assert.equal(result.confidence, 'inferred');
  });

  it('distinguishes a silent host that is rendering, busy within deadline, or wedged', () => {
    assert.equal(classifyHostState(signals({ statusProbe: silent, inFlight: [{ op: 'render_start', ageMs: 60_000, timeoutMs: 600_000 }] })).state, 'rendering');
    assert.equal(classifyHostState(signals({ statusProbe: silent, inFlight: [{ op: 'batch', ageMs: 5_000, timeoutMs: 120_000 }] })).state, 'busy');
    assert.equal(classifyHostState(signals({ statusProbe: silent, inFlight: [{ op: 'batch', ageMs: 130_000, timeoutMs: 120_000 }] })).state, 'wedged');
    assert.equal(classifyHostState(signals({ statusProbe: silent })).state, 'wedged');
    assert.equal(classifyHostState(signals({ statusProbe: silent, inFlight: [{ op: 'cavalry_ping', ageMs: 1_000, timeoutMs: 2_000 }] })).state, 'wedged', 'probes do not justify silence');
  });

  it('treats an older bridge without the status probe as responsive', () => {
    const result = classifyHostState(signals({ statusProbe: { ok: false, latencyMs: 4, failure: 'unsupported' } }));
    assert.equal(result.state, 'idle');
    assert.ok(result.attention.includes('bridge_predates_status_probe'));
  });

  it('flags a recent JavaScript error for attention without declaring a responsive host broken', () => {
    const result = classifyHostState(signals({ dialogClassIncidentTimes: [NOW - 1_000] }));
    assert.equal(result.state, 'idle');
    assert.ok(result.attention.includes('recent_javascript_error'));
  });
});
