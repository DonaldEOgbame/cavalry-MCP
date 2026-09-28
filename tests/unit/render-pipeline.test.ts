import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSupervisedRender, RenderJobSpec, RenderPipelineDeps } from '../../src/render/pipeline.js';
import { FaultPlan } from '../../src/runtime/faults.js';
import type { HostProbeResult } from '../../src/runtime/host-probe.js';
import type { HostState } from '../../src/runtime/host-state.js';
import type { ArtifactReport } from '../../src/render/artifact.js';
import type { RecoveryReport } from '../../src/render/recovery.js';
import { CavalryError } from '../../src/mcp/errors.js';

type RenderBehaviour = 'ok' | 'zero_byte' | 'hang' | 'invalid' | 'lost_response';

interface WorldOptions {
  behaviours?: RenderBehaviour[];
  rangeReset?: boolean[];
  preflight?: HostState;
  recovery?: 'ok' | 'fails' | 'unavailable';
  faults?: string;
  items?: Array<{ id: string; fileName: string }>;
}

function host(state: HostState, extra: Partial<HostProbeResult> = {}): HostProbeResult {
  return {
    state, confidence: 'confirmed', reasons: [state], ready: state === 'idle',
    recoveryRecommended: ['wedged', 'error_dialog_active', 'bridge_disconnected', 'cavalry_not_running'].includes(state),
    attention: [], evidence: {}, probedAt: '', probeMs: 0, ...extra,
  };
}

function createWorld(options: WorldOptions = {}) {
  let clock = 1_000_000;
  const files = new Map<string, { size: number; mtime: number }>();
  const items = new Map<string, Record<string, unknown>>((options.items ?? []).map((item) => [item.id, { fileName: item.fileName }]));
  const deleted: string[] = [];
  const calls: string[] = [];
  const recoveries: string[] = [];
  const journal: Array<{ kind: string; context: Record<string, unknown> }> = [];
  const configuredRangeModes: number[] = [];
  const configuredRanges: unknown[] = [];
  let itemCounter = 0;
  let attempt = 0;
  let hostState: HostState = options.preflight ?? 'idle';
  let killed = 0;
  let activeRender: { itemId: string; jobId: string; behaviour: RenderBehaviour; startedAt: number; staging: string } | null = null;
  let lastRender: Record<string, unknown> | null = null;

  const stagingSize = (file: string): number | null => {
    if (activeRender && file === activeRender.staging) {
      const elapsed = clock - activeRender.startedAt;
      switch (activeRender.behaviour) {
        case 'ok': case 'invalid': case 'lost_response': return elapsed < 1_000 ? 0 : Math.min(5_000_000, elapsed * 1_000);
        case 'zero_byte': return 0;
        case 'hang': return 0;
      }
    }
    return files.get(file)?.size ?? null;
  };

  const deps: RenderPipelineDeps = {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    async send(op, params) {
      calls.push(op);
      if (hostState === 'cavalry_not_running' && op !== 'render_cancel') throw new CavalryError({ code: 'BRIDGE_OFFLINE', message: 'offline' });
      switch (op) {
        case 'render_queue_list': return { items: [...items.keys()].map((id) => ({ id })) };
        case 'render_item_inspect': return { values: items.get(String(params.itemId)) };
        case 'render_item_delete': items.delete(String(params.itemId)); deleted.push(String(params.itemId)); return { deleted: true };
        case 'scene_export_copy': files.set(String(params.filePath), { size: 4_096, mtime: clock }); return { exported: true };
        case 'render_queue_add': { const id = `renderItem#${++itemCounter}`; items.set(id, {}); return { renderQueueItemId: id }; }
        case 'render_item_set_output': Object.assign(items.get(String(params.itemId))!, { fileName: params.fileName, filePath: params.filePath }); return {};
        case 'render_item_set': {
          attempt += 1;
          const values = items.get(String(params.itemId))!;
          const settings = params.settings as Record<string, unknown>;
          configuredRangeModes.push(Number(settings.frameRangeMode));
          configuredRanges.push(settings.frameRange);
          Object.assign(values, settings);
          if (options.rangeReset?.[attempt - 1]) values.frameRange = { x: 0, y: 250 };
          return { values };
        }
        case 'render_start': {
          const values = items.get(String(params.itemId))!;
          const behaviour = options.behaviours?.[attempt - 1] ?? 'ok';
          const staging = `${values.filePath}/${values.fileName}.mp4`;
          activeRender = { itemId: String(params.itemId), jobId: String(params.jobId), behaviour, startedAt: clock, staging };
          if (behaviour === 'hang' || behaviour === 'lost_response') {
            if (behaviour === 'lost_response') lastRender = { jobId: params.jobId, ok: true, nativeCallMs: 6_000 };
            return new Promise(() => {});
          }
          await deps.sleep(behaviour === 'zero_byte' ? 50 : 6_000);
          // A killed host never answers the in-flight request.
          if (hostState === 'cavalry_not_running') return new Promise(() => {});
          return { nativeCallMs: behaviour === 'zero_byte' ? 50 : 6_000 };
        }
        case 'render_cancel': return { cancelled: true };
        default: throw new Error(`unexpected op ${op}`);
      }
    },
    probe: async () => {
      if (hostState !== 'idle') return host(hostState);
      if (activeRender?.behaviour === 'hang') return host('rendering');
      return host('idle', { bridgeStatus: { lastRender } as any });
    },
    waitForIdle: async () => host(hostState),
    fileSize: async (file) => stagingSize(file),
    remove: async (file) => { files.delete(file); },
    rename: async (from, to) => {
      const size = stagingSize(from);
      if (size === null) throw new Error(`rename: missing ${from}`);
      files.set(to, { size, mtime: clock });
      files.delete(from);
      activeRender = null;
    },
    mkdir: async () => {},
    writeJson: async (file) => { files.set(file, { size: 100, mtime: clock }); },
    truncate: async (file) => {
      if (activeRender?.staging === file) activeRender.behaviour = 'zero_byte';
      files.set(file, { size: 0, mtime: clock });
    },
    validate: async (file) => {
      const size = stagingSize(file) ?? 0;
      const invalid = activeRender?.behaviour === 'invalid';
      const failures = size === 0 ? ['non_empty', 'decodable'] : invalid ? ['frame_count', 'duration'] : [];
      return { path: file, verified: failures.length === 0, checks: failures.map((name) => ({ name, ok: false })), failures, facts: { exists: true, size, probed: size > 0, samples: [] } } as ArtifactReport;
    },
    extractFrames: async (_file, frames, _fps, stem) => frames.map((frame) => ({ frame, path: `${stem}-${frame}.png` })),
    recover: async (input): Promise<RecoveryReport> => {
      recoveries.push(input.reason);
      activeRender = null;
      if (options.recovery === 'unavailable') return { ok: false, attempted: false, reason: input.reason, unavailableReason: 'disabled', steps: [], durationMs: 0 };
      if (options.recovery === 'fails') return { ok: false, attempted: true, reason: input.reason, steps: [{ step: 'checkpoint', ok: true, durationMs: 1 }, { step: 'terminate', ok: false, durationMs: 1 }], durationMs: 2 };
      hostState = 'idle';
      return { ok: true, attempted: true, reason: input.reason, steps: [{ step: 'health', ok: true, durationMs: 1 }], durationMs: 20_000, compId: 'compNode#1' };
    },
    killHost: async () => { killed += 1; hostState = 'cavalry_not_running'; if (activeRender) activeRender.behaviour = 'hang'; },
    record: (kind, _message, context) => { journal.push({ kind, context }); },
    faults: new FaultPlan(options.faults ?? ''),
    supervised: new Map(),
    timings: { pollMs: 1_000, stallAfterMs: 120_000, blockedStallAfterMs: 600_000, zeroByteGraceMs: 90_000, jobTimeoutMs: 1_800_000, preflightWaitMs: 60_000, killAfterStartMs: 3_000, hostProbeIntervalMs: 15_000 },
  };
  return {
    deps, files, items, deleted, calls, recoveries, journal, configuredRangeModes, configuredRanges,
    get killed() { return killed; },
    set hostState(value: HostState) { hostState = value; },
  };
}

const spec: RenderJobSpec = { compId: 'compNode#1', startFrame: 0, endFrame: 3119, outputDirectory: '/renders', fileName: 'film', fps: 30, width: 1920, height: 1080, sampleFrames: [28, 1500, 3000] };

describe('supervised disposable render pipeline', () => {
  it('renders to a staging file, validates, promotes atomically, and destroys the item', async () => {
    const world = createWorld();
    const result = await runSupervisedRender({ ...spec, inspectionFrames: 2 }, world.deps);
    assert.equal(result.output, '/renders/film.mp4');
    assert.ok(world.files.has('/renders/film.mp4'));
    assert.equal(result.attempts.length, 1);
    assert.equal(result.recovered, false);
    assert.equal(result.attempts[0].itemDestroyed, true);
    assert.deepEqual([...world.items.keys()], [], 'no render item survives the job');
    assert.ok(result.checkpointPath?.endsWith('.cv'));
    assert.equal(result.frameCount, 3120);
    assert.deepEqual(world.configuredRangeModes, [2], 'explicit ranges use Cavalry custom-range mode');
    assert.deepEqual(world.configuredRanges, [{ x: 0, y: 3119 }], 'custom range upper bound is inclusive');
    assert.deepEqual(result.inspectionFrames?.map((item) => item.frame), [28, 3000], 'inspection frames span the sampled range');
    assert.ok(world.calls.indexOf('scene_export_copy') < world.calls.indexOf('render_queue_add'), 'checkpoint precedes item creation');
    assert.ok([...world.files.keys()].some((file) => file.includes('.cavalry-mcp/reports/')), 'a render report is persisted');
  });

  it('classifies the zero-byte container failure, recovers a clean host, and retries exactly once', async () => {
    const world = createWorld({ behaviours: ['zero_byte', 'ok'] });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(result.attempts.length, 2);
    assert.equal(result.recovered, true);
    const first = result.attempts[0];
    assert.equal(first.failure?.code, 'RENDER_OUTPUT_INVALID');
    assert.equal(first.failure?.evidence?.zeroByteContainer, true);
    assert.equal(first.nativeCallMs, 50);
    assert.equal(first.retryDecision, 'restart');
    assert.equal(first.itemDestroyed, true);
    assert.equal(world.recoveries.length, 1);
    assert.ok(world.journal.some((entry) => entry.kind === 'mcp.render_attempt_failed'));
    assert.ok(world.journal.some((entry) => entry.kind === 'mcp.info.render_recovered'));
  });

  it('never retries more than once and leaves no output behind when both attempts fail', async () => {
    const world = createWorld({ behaviours: ['invalid', 'invalid'] });
    await assert.rejects(runSupervisedRender(spec, world.deps), (error: CavalryError) => {
      assert.equal(error.code, 'RENDER_OUTPUT_INVALID');
      assert.equal((error.diagnostics?.attempts as unknown[]).length, 2);
      return true;
    });
    assert.equal(world.recoveries.length, 1);
    assert.equal(world.files.has('/renders/film.mp4'), false);
    assert.deepEqual([...world.items.keys()], []);
  });

  it('rejects a frame range that Cavalry silently reset and retries on a healthy host without restarting', async () => {
    const world = createWorld({ rangeReset: [true, false] });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(result.attempts[0].failure?.stage, 'configure');
    assert.match(result.attempts[0].failure?.message ?? '', /frameRange/);
    assert.equal(result.attempts[0].retryDecision, 'retry');
    assert.equal(world.recoveries.length, 0);
    assert.equal(world.calls.includes('render_start'), true);
    assert.equal(world.calls.filter((op) => op === 'render_start').length, 1, 'a misconfigured item is never rendered');
  });

  it('detects host loss mid-render (injected SIGKILL) quickly and recovers', async () => {
    const world = createWorld({ faults: 'render.kill_host_after_start' });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(world.killed, 1);
    assert.equal(result.attempts[0].failure?.code, 'HOST_WEDGED');
    assert.match(result.attempts[0].failure?.message ?? '', /cavalry_not_running/);
    assert.ok(result.attempts[0].durationMs < 60_000, `host loss detected in ${result.attempts[0].durationMs}ms`);
    assert.deepEqual(result.attempts[0].faultsInjected, ['render.kill_host_after_start']);
    assert.equal(result.recovered, true);
    assert.ok(world.journal.some((entry) => entry.kind === 'mcp.info.fault_injected'));
  });

  it('fails with the render cause and recovery evidence when restart is not permitted on an unhealthy host', async () => {
    const world = createWorld({ faults: 'render.kill_host_after_start', recovery: 'unavailable' });
    await assert.rejects(runSupervisedRender(spec, world.deps), (error: CavalryError) => {
      assert.equal(error.code, 'HOST_WEDGED');
      const [attempt] = error.diagnostics?.attempts as any[];
      assert.equal(attempt.recovery.unavailableReason, 'disabled');
      assert.equal(attempt.retryDecision, 'stop');
      return true;
    });
  });

  it('reports HOST_RECOVERY_FAILED with the failing step', async () => {
    const world = createWorld({ behaviours: ['zero_byte', 'ok'], recovery: 'fails' });
    await assert.rejects(runSupervisedRender(spec, world.deps), (error: CavalryError) => {
      assert.equal(error.code, 'HOST_RECOVERY_FAILED');
      assert.match(error.message, /terminate/);
      return true;
    });
  });

  it('refuses to start on a wedged host without touching the Render Manager', async () => {
    const world = createWorld({ preflight: 'wedged' });
    await assert.rejects(runSupervisedRender(spec, world.deps), (error: CavalryError) => error.code === 'HOST_WEDGED' && error.hostState === 'wedged');
    assert.equal(world.calls.includes('render_queue_add'), false);
  });

  it('purges only Render Manager items that earlier MCP jobs created', async () => {
    const world = createWorld({ items: [{ id: 'renderItem#90', fileName: 'film__mcp_deadbeef' }, { id: 'renderItem#91', fileName: 'client-export' }] });
    await runSupervisedRender(spec, world.deps);
    assert.ok(world.deleted.includes('renderItem#90'));
    assert.equal(world.deleted.includes('renderItem#91'), false);
    assert.deepEqual([...world.items.keys()], ['renderItem#91']);
  });

  it('catches an output corrupted after rendering (injected) and rerenders on a clean host', async () => {
    const world = createWorld({ faults: 'render.corrupt_output' });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(result.attempts[0].outcome, 'failed');
    assert.equal(result.attempts[1].outcome, 'validated');
    assert.equal(world.recoveries.length, 1);
  });

  it('recovers from a lost render response using the bridge render record', async () => {
    const world = createWorld({ behaviours: ['lost_response'] });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(result.attempts.length, 1);
    assert.equal(result.attempts[0].outcome, 'validated');
  });

  it('fails a render that blocks without output progress, then succeeds after recovery', async () => {
    const world = createWorld({ behaviours: ['hang', 'ok'] });
    const result = await runSupervisedRender(spec, world.deps);
    assert.equal(result.attempts[0].failure?.code, 'RENDER_STALLED');
    assert.equal(result.attempts[0].failure?.evidence?.nativeCallPending, true);
    assert.ok(world.calls.includes('render_cancel'));
    assert.equal(result.recovered, true);
  });

  it('stops a cancelled render without retrying, cancels natively, and destroys the item', async () => {
    const world = createWorld();
    const controller = new AbortController();
    const fileSize = world.deps.fileSize;
    let polls = 0;
    world.deps.fileSize = async (file) => {
      if (file.includes('__mcp_') && ++polls === 1) controller.abort();
      return fileSize(file);
    };
    await assert.rejects(runSupervisedRender({ ...spec, signal: controller.signal }, world.deps), (error: CavalryError) => {
      assert.equal(error.code, 'OPERATION_CANCELLED');
      assert.equal((error.diagnostics?.attempts as unknown[]).length, 1);
      return true;
    });
    assert.deepEqual([...world.items.keys()], [], 'the cancelled item is destroyed');
    assert.equal(world.recoveries.length, 1, 'cancellation resets Render Manager even when the first health probe looks idle');
    assert.equal(world.files.has('/renders/film.mp4'), false);
  });

  it('serializes concurrent render jobs so they never share the Render Manager', async () => {
    const log: string[] = [];
    const first = createWorld();
    const second = createWorld();
    for (const [name, world] of [['A', first], ['B', second]] as const) {
      const send = world.deps.send;
      world.deps.send = async (op, params, timeout) => { log.push(`${name}:${op}`); return send(op, params, timeout); };
    }
    await Promise.all([runSupervisedRender(spec, first.deps), runSupervisedRender(spec, second.deps)]);
    const lastA = log.lastIndexOf('A:render_item_delete');
    const firstB = log.findIndex((entry) => entry.startsWith('B:'));
    assert.ok(lastA < firstB, `job B started before job A finished: ${log.join(' ')}`);
  });
});
