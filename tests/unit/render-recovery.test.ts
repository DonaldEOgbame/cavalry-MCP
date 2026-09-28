import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recoverCleanHost, RecoveryDeps } from '../../src/render/recovery.js';
import { FaultPlan } from '../../src/runtime/faults.js';
import type { HostProbeResult } from '../../src/runtime/host-probe.js';

function deps(overrides: Partial<RecoveryDeps> & { events?: string[] } = {}): RecoveryDeps {
  const events = overrides.events ?? [];
  let clock = 0;
  let listening = false;
  return {
    process: {
      supported: true,
      isRunning: async () => true,
      terminate: async () => { events.push('terminate'); return { wasRunning: true, exited: true, forced: true, durationMs: 10_000 }; },
      launch: async () => { events.push('launch'); listening = true; },
      activateBridge: async () => { events.push('activate'); listening = true; return true; },
    },
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    fileSize: async () => 8_192,
    bridgeListening: async () => listening,
    bridgeHealthy: async () => listening,
    openScene: async (path) => { events.push(`open:${path}`); },
    layerCount: async () => 138,
    activeComp: async () => 'compNode#1',
    setActiveComp: async () => true,
    probe: async () => ({ state: 'idle', confidence: 'confirmed', reasons: ['ok'], ready: true, recoveryRecommended: false, attention: [], evidence: {}, probedAt: '', probeMs: 1 } as HostProbeResult),
    bridgeWaitMs: 5_000,
    activationWaitMs: 5_000,
    ...overrides,
  };
}

const input = { checkpointPath: '/renders/.cavalry-mcp/checkpoints/film.cv', reason: 'render: zero-byte container', expectedMinimumLayers: 138, compId: 'compNode#1' };

describe('clean-host recovery', () => {
  it('terminates, relaunches, reconnects, reopens the checkpoint, verifies, and confirms idle — in that order', async () => {
    const events: string[] = [];
    const report = await recoverCleanHost(input, deps({ events }));
    assert.equal(report.ok, true);
    assert.deepEqual(report.steps.map((step) => step.step), ['checkpoint', 'terminate', 'launch', 'bridge', 'reopen', 'verify', 'health']);
    assert.deepEqual(events, ['terminate', 'launch', `open:${input.checkpointPath}`]);
    assert.equal(report.compId, 'compNode#1');
    assert.equal(report.hostAfter?.state, 'idle');
  });

  it('falls back to menu activation when Cavalry does not restore the bridge', async () => {
    const events: string[] = [];
    const base = deps({ events });
    base.process.launch = async () => { events.push('launch'); };
    const report = await recoverCleanHost(input, base);
    assert.equal(report.ok, true);
    assert.ok(events.includes('activate'));
    assert.deepEqual(report.steps.find((step) => step.step === 'bridge')?.detail, { activation: 'menu' });
  });

  it('refuses to restart without a usable checkpoint', async () => {
    const events: string[] = [];
    const report = await recoverCleanHost(input, deps({ events, fileSize: async () => 0 }));
    assert.equal(report.ok, false);
    assert.deepEqual(events, [], 'Cavalry is never killed without something to reopen');
  });

  it('fails verification when the reopened scene is missing layers', async () => {
    const report = await recoverCleanHost(input, deps({ layerCount: async () => 12 }));
    assert.equal(report.ok, false);
    assert.equal(report.steps.at(-1)?.step, 'verify');
  });

  it('stops when Cavalry cannot be terminated', async () => {
    const base = deps();
    base.process.terminate = async () => ({ wasRunning: true, exited: false, forced: true, durationMs: 15_000 });
    const report = await recoverCleanHost(input, base);
    assert.equal(report.ok, false);
    assert.equal(report.steps.at(-1)?.step, 'terminate');
  });

  it('reports unavailability without attempting anything when restart is not permitted', async () => {
    const base = deps();
    base.process = { ...base.process, supported: false, unsupportedReason: 'disabled' };
    const report = await recoverCleanHost(input, base);
    assert.equal(report.attempted, false);
    assert.equal(report.unavailableReason, 'disabled');
  });
});

describe('fault injection plan', () => {
  it('fires each configured fault the configured number of times', () => {
    const plan = new FaultPlan('render.corrupt_output:2, render.stall');
    assert.equal(plan.take('render.stall'), true);
    assert.equal(plan.take('render.stall'), false);
    assert.equal(plan.take('render.corrupt_output'), true);
    assert.equal(plan.take('render.corrupt_output'), true);
    assert.equal(plan.take('render.corrupt_output'), false);
    assert.equal(plan.take('render.kill_host_after_start'), false);
    assert.equal(plan.report().fired.length, 3);
  });

  it('rejects unknown faults and invalid counts loudly', () => {
    assert.throws(() => new FaultPlan('render.explode'), /Unknown fault/);
    assert.throws(() => new FaultPlan('render.stall:0'), /Invalid count/);
    assert.equal(new FaultPlan('').active, false);
  });
});
