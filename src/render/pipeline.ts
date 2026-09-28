import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { bridgeClient } from '../bridge/client.js';
import { CavalryError, CavalryErrorCode } from '../mcp/errors.js';
import { HostProbeResult, probeHost, SupervisedRender, supervisedRenders, waitForIdleHost } from '../runtime/host-probe.js';
import { incidentJournal } from '../runtime/incidents.js';
import { FaultPlan, faults as defaultFaults } from '../runtime/faults.js';
import { killCavalry } from '../runtime/process-control.js';
import { ArtifactExpectation, ArtifactReport, extractInspectionFrames, validateArtifact } from './artifact.js';
import { recoverCleanHost, RecoveryInput, RecoveryReport } from './recovery.js';

const execFileAsync = promisify(execFile);

/**
 * Disposable, supervised rendering. Every attempt uses a fresh Render Manager
 * item that is destroyed afterwards, writes to a private staging file, and is
 * accepted only after artifact validation, at which point the staging file is
 * atomically promoted to the requested name. A failed attempt triggers
 * clean-host recovery (when enabled) and exactly one retry.
 */
export interface RenderJobSpec {
  compId?: string;
  /** Inclusive composition frame range. */
  startFrame: number;
  endFrame: number;
  outputDirectory: string;
  fileName: string;
  fps: number;
  width: number;
  height: number;
  codec?: 'h264';
  /** Absolute composition frames to decode during validation. */
  sampleFrames?: number[];
  allowBlankFrames?: number;
  allowStaticContent?: boolean;
  /** 1 = no retry; 2 = retry exactly once (default). */
  maxAttempts?: number;
  /** Frames to extract from the validated artifact for visual inspection. */
  inspectionFrames?: number;
  /** Reuse an existing checkpoint instead of exporting a new one. */
  checkpointPath?: string;
  expectedMinimumLayers?: number;
  label?: string;
  /** Client cancellation (MCP request abort). A cancelled job is never retried. */
  signal?: AbortSignal;
}

export type RenderStage = 'preflight' | 'checkpoint' | 'create' | 'configure' | 'render' | 'validate' | 'promote';

export interface RenderFailure {
  stage: RenderStage;
  code: CavalryErrorCode;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface RenderAttempt {
  attempt: number;
  attemptId: string;
  itemId?: string;
  stagingPath: string;
  startedAt: string;
  durationMs: number;
  outcome: 'validated' | 'failed';
  failure?: RenderFailure;
  nativeCallMs?: number;
  output: { finalSize: number; firstByteAfterMs: number | null; growthEvents: number };
  validation?: ArtifactReport;
  itemDestroyed: boolean | 'not_created';
  hostAfter?: Pick<HostProbeResult, 'state' | 'confidence' | 'reasons'>;
  recovery?: RecoveryReport;
  retryDecision?: 'restart' | 'retry' | 'stop';
  faultsInjected: string[];
}

export interface RenderJobResult {
  jobId: string;
  output: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  attempts: RenderAttempt[];
  recovered: boolean;
  checkpointPath: string | null;
  outputVerification: ArtifactReport & { verified: true };
  finalStatus: { state: 'COMPLETED'; reliable: true; progress: 100 };
  inspectionFrames?: Array<{ frame: number; path: string }>;
  reportPath: string;
  durationMs: number;
}

export interface RenderPipelineTimings {
  pollMs: number;
  /** No output growth after the native call returned. */
  stallAfterMs: number;
  /** No output growth while the native call is still blocking. */
  blockedStallAfterMs: number;
  /** Empty container with an idle host after the native call returned. */
  zeroByteGraceMs: number;
  jobTimeoutMs: number;
  preflightWaitMs: number;
  killAfterStartMs: number;
  /** How often the host is probed while a render is supervised. */
  hostProbeIntervalMs: number;
}

export interface RenderPipelineDeps {
  now(): number;
  sleep(ms: number): Promise<void>;
  send<T = any>(op: string, params: Record<string, unknown>, timeoutMs: number): Promise<T>;
  probe(): Promise<HostProbeResult>;
  waitForIdle(timeoutMs: number): Promise<HostProbeResult>;
  fileSize(file: string): Promise<number | null>;
  remove(file: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(directory: string): Promise<void>;
  writeJson(file: string, value: unknown): Promise<void>;
  truncate(file: string): Promise<void>;
  validate(file: string, expectation: ArtifactExpectation): Promise<ArtifactReport>;
  extractFrames(file: string, frames: number[], fps: number, stem: string): Promise<Array<{ frame: number; path: string }>>;
  recover(input: RecoveryInput): Promise<RecoveryReport>;
  killHost(): Promise<void>;
  record(kind: string, message: string, context: Record<string, unknown>): void;
  faults: FaultPlan;
  supervised: Map<string, SupervisedRender>;
  timings: RenderPipelineTimings;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function defaultRenderTimings(): RenderPipelineTimings {
  return {
    pollMs: 1_000,
    stallAfterMs: envNumber('CAVALRY_RENDER_STALL_MS', 120_000),
    blockedStallAfterMs: envNumber('CAVALRY_RENDER_BLOCKED_STALL_MS', 600_000),
    zeroByteGraceMs: envNumber('CAVALRY_RENDER_ZERO_BYTE_GRACE_MS', 90_000),
    jobTimeoutMs: envNumber('CAVALRY_RENDER_TIMEOUT_MS', 30 * 60 * 1000),
    preflightWaitMs: 60_000,
    killAfterStartMs: 3_000,
    hostProbeIntervalMs: 15_000,
  };
}

export function defaultRenderPipelineDeps(): RenderPipelineDeps {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    send: async (op, params, timeoutMs) => (await bridgeClient.send<any>(op, params, timeoutMs)).result,
    probe: () => probeHost(),
    waitForIdle: (timeoutMs) => waitForIdleHost({ timeoutMs }),
    fileSize: async (file) => { try { return (await fs.stat(file)).size; } catch { return null; } },
    remove: (file) => fs.rm(file, { force: true }),
    rename: (from, to) => fs.rename(from, to),
    mkdir: async (directory) => { await fs.mkdir(directory, { recursive: true }); },
    writeJson: (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'),
    truncate: (file) => fs.truncate(file, 0),
    validate: validateArtifact,
    extractFrames: extractInspectionFrames,
    recover: (input) => recoverCleanHost(input),
    killHost: killCavalry,
    record: (kind, message, context) => { incidentJournal.record(kind, message, context); },
    faults: defaultFaults,
    supervised: supervisedRenders,
    timings: defaultRenderTimings(),
  };
}

// One render at a time: concurrent jobs would share Cavalry's Render Manager.
let renderLock: Promise<void> = Promise.resolve();

async function withRenderLock<T>(signal: AbortSignal | undefined, job: () => Promise<T>): Promise<T> {
  const previous = renderLock;
  let release!: () => void;
  renderLock = new Promise<void>((resolve) => { release = resolve; });
  try {
    await previous;
    if (signal?.aborted) throw new CavalryError({ code: 'OPERATION_CANCELLED', message: 'Render cancelled before it started.', operation: 'render' });
    return await job();
  } finally {
    release();
  }
}

class PipelineFailure extends Error {
  constructor(readonly failure: RenderFailure) { super(failure.message); }
}

const OWNED_ITEM = /__mcp_[0-9a-f]{8}$/;

function fail(stage: RenderStage, code: CavalryErrorCode, message: string, evidence?: Record<string, unknown>): never {
  throw new PipelineFailure({ stage, code, message, ...(evidence ? { evidence } : {}) });
}

function failureFromError(stage: RenderStage, error: unknown): RenderFailure {
  if (error instanceof PipelineFailure) return error.failure;
  const code = error instanceof CavalryError ? error.code : 'CAVALRY_ERROR';
  const mapped: CavalryErrorCode = code === 'BRIDGE_TIMEOUT' ? 'HOST_WEDGED' : code;
  return { stage, code: mapped, message: error instanceof Error ? error.message : String(error), evidence: error instanceof CavalryError && error.incidentId ? { incidentId: error.incidentId } : undefined };
}

function sameRange(value: unknown, x: number, y: number): boolean {
  const range = value as { x?: unknown; y?: unknown } | null;
  return Boolean(range) && Number(range!.x) === x && Number(range!.y) === y;
}

function hostSummary(host: HostProbeResult | undefined): RenderAttempt['hostAfter'] {
  return host ? { state: host.state, confidence: host.confidence, reasons: host.reasons } : undefined;
}

/** Removes Render Manager items left behind by earlier MCP renders (identified by their staging name). */
async function purgeOwnedItems(deps: RenderPipelineDeps): Promise<string[]> {
  const removed: string[] = [];
  const listed = await deps.send<{ items?: Array<{ id: string }> }>('render_queue_list', {}, 30_000);
  for (const item of listed?.items ?? []) {
    let fileName: unknown;
    try { fileName = (await deps.send<any>('render_item_inspect', { itemId: item.id, attributes: ['fileName'] }, 30_000))?.values?.fileName; } catch { continue; }
    if (typeof fileName === 'string' && OWNED_ITEM.test(fileName)) {
      await deps.send('render_item_delete', { itemId: item.id }, 30_000);
      removed.push(item.id);
    }
  }
  return removed;
}

/** Render/validation failures and unhealthy hosts get a clean host; setup failures on a healthy host just retry. */
function decideRetry(attempt: RenderAttempt, host: HostProbeResult | undefined): 'restart' | 'retry' | 'stop' {
  if (attempt.failure?.code === 'OPERATION_CANCELLED') return 'stop';
  const needsCleanHost = attempt.failure?.stage === 'render' || attempt.failure?.stage === 'validate' || host?.recoveryRecommended === true;
  if (needsCleanHost) return 'restart';
  if (host?.ready) return 'retry';
  return 'stop';
}

async function runAttempt(spec: RenderJobSpec, deps: RenderPipelineDeps, context: { jobId: string; attempt: number; compId?: string; expectation: ArtifactExpectation; finalPath: string }): Promise<RenderAttempt> {
  const { timings } = deps;
  const started = deps.now();
  const attemptId = crypto.randomUUID();
  const stagingStem = `${spec.fileName.replace(/\.mp4$/i, '')}__mcp_${attemptId.replace(/-/g, '').slice(0, 8)}`;
  const stagingPath = path.join(spec.outputDirectory, `${stagingStem}.mp4`);
  const faultsInjected: string[] = [];
  const injected = (name: Parameters<FaultPlan['take']>[0]) => {
    if (!deps.faults.take(name)) return false;
    faultsInjected.push(name);
    deps.record('mcp.info.fault_injected', `Injected fault ${name}`, { fault: name, jobId: context.jobId, attempt: context.attempt });
    return true;
  };
  const record: RenderAttempt = {
    attempt: context.attempt, attemptId, stagingPath, startedAt: new Date(started).toISOString(), durationMs: 0,
    outcome: 'failed', output: { finalSize: 0, firstByteAfterMs: null, growthEvents: 0 }, itemDestroyed: 'not_created', faultsInjected,
  };
  let itemId: string | undefined;
  let stage: RenderStage = 'create';
  let renderCallPending = false;
  const cancelled = () => { if (spec.signal?.aborted) fail(stage, 'OPERATION_CANCELLED', 'Render cancelled by the client.'); };
  try {
    cancelled();
    await deps.remove(stagingPath);
    const added = await deps.send<{ renderQueueItemId: string }>('render_queue_add', context.compId ? { compId: context.compId } : {}, 60_000);
    itemId = added?.renderQueueItemId;
    if (!itemId) fail('create', 'RENDER_FAILED', 'Render Manager did not return a queue item id.');
    record.itemId = itemId;
    record.itemDestroyed = false;

    stage = 'configure';
    // Selecting the generator resets the frame range in Cavalry 2.7.2, so the
    // generator goes first and the range is set and read back afterwards.
    // Render Manager's upper bound is exclusive.
    await deps.send('render_item_set_output', { itemId, filePath: spec.outputDirectory, fileName: stagingStem, formatType: 'renderMP4' }, 120_000);
    const upper = spec.endFrame + 1;
    const inspected = await deps.send<{ values?: Record<string, unknown> }>('render_item_set', { itemId, settings: { frameRangeMode: 1, frameRange: { x: spec.startFrame, y: upper } } }, 120_000);
    const values = inspected?.values ?? {};
    const mismatches: string[] = [];
    if (!sameRange(values.frameRange, spec.startFrame, upper)) mismatches.push(`frameRange=${JSON.stringify(values.frameRange)}`);
    if (values.frameRangeMode !== undefined && Number(values.frameRangeMode) !== 1) mismatches.push(`frameRangeMode=${String(values.frameRangeMode)}`);
    if (values.fileName !== undefined && values.fileName !== stagingStem) mismatches.push(`fileName=${String(values.fileName)}`);
    if (injected('render.fail_configure')) mismatches.push('fault:render.fail_configure');
    if (mismatches.length) fail('configure', 'RENDER_FAILED', `Render item readback does not match the requested settings: ${mismatches.join(', ')}`, { values });

    stage = 'render';
    const renderStarted = deps.now();
    const supervision: SupervisedRender = { jobId: attemptId, startedAt: renderStarted, lastProgressAt: null, stallAfterMs: timings.stallAfterMs };
    deps.supervised.set(attemptId, supervision);
    let settled: { ok: true; value: any; at: number } | { ok: false; error: unknown; at: number } | null = null;
    renderCallPending = true;
    void deps.send('render_start', { itemId, jobId: attemptId }, timings.jobTimeoutMs)
      .then((value) => { settled = { ok: true, value, at: deps.now() }; }, (error) => { settled = { ok: false, error, at: deps.now() }; })
      .finally(() => { renderCallPending = false; });
    if (injected('render.kill_host_after_start')) {
      await deps.sleep(timings.killAfterStartMs);
      await deps.killHost();
    }
    const stallInjected = injected('render.stall');
    let lastSize = -1;
    let stableSince: number | null = null;
    let lastValidatedSize = -1;
    let lastHostProbe = renderStarted;
    let report: ArtifactReport | undefined;
    for (;;) {
      await deps.sleep(timings.pollMs);
      cancelled();
      const now = deps.now();
      const size = (await deps.fileSize(stagingPath)) ?? -1;
      if (size > lastSize && size > 0) {
        supervision.lastProgressAt = now;
        record.output.growthEvents += 1;
        if (record.output.firstByteAfterMs === null) record.output.firstByteAfterMs = now - renderStarted;
        stableSince = null;
      } else if (size === lastSize && stableSince === null) {
        stableSince = now;
      }
      lastSize = Math.max(lastSize, size);
      record.output.finalSize = Math.max(size, 0);
      if (now - renderStarted > timings.jobTimeoutMs) fail('render', 'RENDER_STALLED', `Render exceeded the job timeout of ${timings.jobTimeoutMs}ms.`, { outputSize: size });

      // Host loss is checked whether or not the native call has returned:
      // Cavalry may keep encoding after an asynchronous api.render() returns.
      if (now - lastHostProbe >= timings.hostProbeIntervalMs) {
        lastHostProbe = now;
        const host = await deps.probe();
        if (host.state === 'cavalry_not_running' || host.state === 'bridge_disconnected') {
          fail('render', 'HOST_WEDGED', `Host was lost during the render (${host.state}).`, { hostState: host.state, outputSize: size });
        }
        if (host.state === 'error_dialog_active' && host.confidence === 'confirmed') {
          fail('render', 'HOST_ERROR_DIALOG', 'A Cavalry error dialog appeared during the render.', { hostState: host.state, outputSize: size });
        }
        // The bridge records every render it ran; if it is idle and has
        // finished this job, the response was lost rather than the render.
        const lastRender = host.bridgeStatus?.lastRender as { jobId?: string; ok?: boolean; nativeCallMs?: number; error?: { message?: string } } | null | undefined;
        if (settled) {
          // Native call already returned; nothing more to reconcile.
        } else if (host.state === 'idle' && lastRender?.jobId === attemptId) {
          settled = lastRender.ok === false
            ? { ok: false, error: new Error(lastRender.error?.message ?? 'render failed'), at: now }
            : { ok: true, value: { nativeCallMs: lastRender.nativeCallMs, recoveredFromBridgeStatus: true }, at: now };
        } else if (host.state === 'idle' && now - renderStarted > timings.zeroByteGraceMs) {
          fail('render', 'RENDER_FAILED', 'The host is idle but never ran or answered this render request.', { hostState: host.state, outputSize: size, bridgeLastRender: lastRender ?? null });
        }
      }

      const outcome = settled as { ok: true; value: any; at: number } | { ok: false; error: unknown; at: number } | null;
      if (outcome && !outcome.ok) {
        fail('render', failureFromError('render', outcome.error).code, `Render call failed: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`, { outputSize: size });
      }
      if (!outcome) {
        if (now - (supervision.lastProgressAt ?? renderStarted) > timings.blockedStallAfterMs) {
          fail('render', 'RENDER_STALLED', `Native render call has blocked for ${now - renderStarted}ms without output progress.`, { outputSize: size, nativeCallPending: true });
        }
        continue;
      }
      record.nativeCallMs = Number(outcome.value?.nativeCallMs ?? (outcome.at - renderStarted));
      if (stallInjected) fail('render', 'RENDER_STALLED', 'Injected stall: render treated as making no progress.', { outputSize: size, injected: true });
      const idleFor = now - (supervision.lastProgressAt ?? outcome.at);
      if (size <= 0) {
        if (now - outcome.at > timings.zeroByteGraceMs) {
          const host = await deps.probe();
          if (host.state === 'cavalry_not_running' || host.state === 'bridge_disconnected') {
            fail('render', 'HOST_WEDGED', `Host was lost during the render (${host.state}).`, { hostState: host.state, outputSize: size });
          }
          if (host.state !== 'rendering') {
            fail('render', 'RENDER_OUTPUT_INVALID', `Render returned ${now - outcome.at}ms ago but the output container is ${size === 0 ? 'still empty' : 'missing'} and the host is ${host.state}.`, { zeroByteContainer: size === 0, outputMissing: size < 0, nativeCallMs: record.nativeCallMs, hostState: host.state });
          }
        }
        if (idleFor > timings.stallAfterMs) fail('render', 'RENDER_STALLED', `No output for ${idleFor}ms after the render call returned.`, { outputSize: size });
        continue;
      }
      // Validate once the file stops growing; an encoder may still be writing
      // the index, so an invalid-but-stable file is retried until the stall window.
      if (stableSince !== null && size !== lastValidatedSize) {
        lastValidatedSize = size;
        if (injected('render.corrupt_output')) await deps.truncate(stagingPath);
        report = await deps.validate(stagingPath, context.expectation);
        if (report.verified) break;
      }
      if (idleFor > timings.stallAfterMs) {
        stage = 'validate';
        fail('validate', 'RENDER_OUTPUT_INVALID', `Rendered output failed validation: ${report?.failures.join(', ') ?? 'not validated'}.`, { failures: report?.failures, checks: report?.checks.filter((item) => !item.ok) });
      }
    }
    record.validation = report;

    stage = 'promote';
    await deps.remove(context.finalPath);
    await deps.rename(stagingPath, context.finalPath);
    record.validation = { ...report!, path: context.finalPath };
    record.outcome = 'validated';
  } catch (error) {
    record.failure = failureFromError(stage, error);
    if (renderCallPending) {
      try { await deps.send('render_cancel', {}, 5_000); } catch {}
    }
    deps.record('mcp.render_attempt_failed', record.failure.message, { jobId: context.jobId, attempt: context.attempt, stage: record.failure.stage, code: record.failure.code, evidence: record.failure.evidence ?? null, faultsInjected, injected: faultsInjected.length > 0 });
  } finally {
    deps.supervised.delete(attemptId);
    if (itemId) {
      try {
        await deps.send('render_item_delete', { itemId }, 15_000);
        record.itemDestroyed = true;
      } catch {
        // Recovery reopens a checkpoint taken before the item existed, and the
        // next job purges owned items by name, so it cannot leak into a retry.
        record.itemDestroyed = false;
      }
    }
    if (record.outcome !== 'validated') await deps.remove(stagingPath).catch(() => undefined);
    record.durationMs = deps.now() - started;
  }
  return record;
}

export function runSupervisedRender(spec: RenderJobSpec, deps: RenderPipelineDeps = defaultRenderPipelineDeps()): Promise<RenderJobResult> {
  return withRenderLock(spec.signal, () => superviseRender(spec, deps));
}

async function superviseRender(spec: RenderJobSpec, deps: RenderPipelineDeps): Promise<RenderJobResult> {
  const started = deps.now();
  const jobId = crypto.randomUUID();
  const stem = spec.fileName.replace(/\.mp4$/i, '');
  const finalPath = path.join(spec.outputDirectory, `${stem}.mp4`);
  const workDirectory = path.join(spec.outputDirectory, '.cavalry-mcp');
  const reportPath = path.join(workDirectory, 'reports', `${stem}-${jobId.slice(0, 8)}.json`);
  const frameCount = spec.endFrame - spec.startFrame + 1;
  if (!Number.isInteger(spec.startFrame) || !Number.isInteger(spec.endFrame) || frameCount < 1) {
    throw new CavalryError({ code: 'INVALID_VALUE', message: `Invalid render range ${spec.startFrame}–${spec.endFrame}.` });
  }
  const maxAttempts = Math.max(1, Math.min(2, spec.maxAttempts ?? 2));
  const expectation: ArtifactExpectation = {
    codec: spec.codec ?? 'h264', width: spec.width, height: spec.height, fps: spec.fps, frameCount,
    sampleFrames: spec.sampleFrames?.map((frame) => frame - spec.startFrame).filter((frame) => frame >= 0 && frame < frameCount),
    allowBlankFrames: spec.allowBlankFrames ?? 0,
    allowStaticContent: spec.allowStaticContent,
  };
  const attempts: RenderAttempt[] = [];
  let checkpointPath: string | null = spec.checkpointPath ?? null;
  let compId = spec.compId;
  let preflight: HostProbeResult | undefined;
  let purged: string[] = [];

  const finish = async (outcome: Record<string, unknown>) => {
    await deps.mkdir(path.dirname(reportPath));
    await deps.writeJson(reportPath, { jobId, spec, startedAt: new Date(started).toISOString(), durationMs: deps.now() - started, preflight: hostSummary(preflight), purgedItems: purged, checkpointPath, attempts, ...outcome });
  };
  const abort = async (failure: RenderFailure, host?: HostProbeResult): Promise<never> => {
    await finish({ ok: false, failure });
    throw new CavalryError({
      code: failure.code,
      message: `Render ${failure.stage} failed: ${failure.message}`,
      operation: 'render',
      hostState: host?.state,
      diagnostics: { jobId, reportPath, failure, attempts: attempts.map(({ attempt, outcome, failure: attemptFailure, retryDecision, recovery, itemDestroyed, hostAfter, faultsInjected }) => ({ attempt, outcome, failure: attemptFailure, retryDecision, recovery: recovery ? { ok: recovery.ok, attempted: recovery.attempted, unavailableReason: recovery.unavailableReason, steps: recovery.steps.map(({ step, ok }) => ({ step, ok })) } : undefined, itemDestroyed, hostAfter, faultsInjected })) },
      suggestion: failure.code === 'HOST_RECOVERY_FAILED' ? 'Restart Cavalry manually, reopen the checkpoint, and rerun the render.' : 'Inspect the render report and incident journal referenced in diagnostics.',
    });
  };

  await deps.mkdir(path.join(workDirectory, 'checkpoints'));
  // A stale file with the final name must never be mistaken for new output.
  await deps.remove(finalPath);

  preflight = await deps.probe();
  if (!preflight.ready && (preflight.state === 'busy' || preflight.state === 'rendering')) preflight = await deps.waitForIdle(deps.timings.preflightWaitMs);
  if (!preflight.ready) {
    await abort({ stage: 'preflight', code: preflight.state === 'error_dialog_active' ? 'HOST_ERROR_DIALOG' : preflight.state === 'busy' || preflight.state === 'rendering' ? 'HOST_BUSY' : 'HOST_WEDGED', message: `Host is ${preflight.state}: ${preflight.reasons.join('; ')}`, evidence: { attention: preflight.attention } }, preflight);
  }

  try {
    purged = await purgeOwnedItems(deps);
    if (!checkpointPath) {
      checkpointPath = path.join(workDirectory, 'checkpoints', `${stem}-${jobId.slice(0, 8)}.cv`);
      await deps.send('scene_export_copy', { filePath: checkpointPath }, 180_000);
      const size = await deps.fileSize(checkpointPath);
      if (!size) fail('checkpoint', 'RENDER_FAILED', `Scene checkpoint was not written to ${checkpointPath}.`);
    }
  } catch (error) {
    await abort(failureFromError('checkpoint', error));
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const record = await runAttempt(spec, deps, { jobId, attempt, compId, expectation, finalPath });
    attempts.push(record);
    if (record.outcome === 'validated') break;
    const host = await deps.probe().catch(() => undefined);
    record.hostAfter = hostSummary(host);
    if (attempt === maxAttempts) break;
    let decision = decideRetry(record, host);
    if (decision === 'restart') {
      record.recovery = await deps.recover({ checkpointPath: checkpointPath!, reason: `${record.failure?.stage}: ${record.failure?.message}`, expectedMinimumLayers: spec.expectedMinimumLayers, compId });
      if (!record.recovery.attempted) {
        // Restart is not permitted on this host; retry only if it is healthy.
        decision = host?.ready ? 'retry' : 'stop';
      } else if (!record.recovery.ok) {
        record.retryDecision = 'stop';
        await abort({ stage: record.failure?.stage ?? 'render', code: 'HOST_RECOVERY_FAILED', message: `Clean-host recovery failed at ${record.recovery.steps.find((step) => !step.ok)?.step ?? 'unknown step'}.`, evidence: { recovery: record.recovery } }, host);
      } else {
        compId = record.recovery.compId ?? compId;
        deps.record('mcp.info.render_recovered', 'Clean-host recovery completed; retrying render once.', { jobId, attempt, durationMs: record.recovery.durationMs });
      }
    }
    record.retryDecision = decision;
    if (decision === 'stop') break;
  }

  const last = attempts[attempts.length - 1];
  if (last.outcome !== 'validated') {
    const host = await deps.probe().catch(() => undefined);
    // A cancelled render must not leave a wedged Render Manager for the next job.
    if (last.failure?.code === 'OPERATION_CANCELLED' && host?.recoveryRecommended && checkpointPath) {
      last.recovery = await deps.recover({ checkpointPath, reason: 'host unhealthy after cancellation', expectedMinimumLayers: spec.expectedMinimumLayers, compId });
    }
    await abort(last.failure ?? { stage: 'render', code: 'RENDER_FAILED', message: 'Render failed without a recorded cause.' }, host);
  }

  let inspectionFrames: Array<{ frame: number; path: string }> | undefined;
  if (spec.inspectionFrames && spec.inspectionFrames > 0) {
    const relative = (expectation.sampleFrames?.length ? expectation.sampleFrames : last.validation!.facts.samples.map((sample) => sample.frame));
    const step = Math.max(1, Math.ceil(relative.length / spec.inspectionFrames));
    const chosen = relative.filter((_, index) => index % step === 0).slice(0, spec.inspectionFrames);
    inspectionFrames = (await deps.extractFrames(finalPath, chosen, spec.fps, path.join(workDirectory, 'inspection', `${stem}-${jobId.slice(0, 8)}`)))
      .map((item) => ({ frame: item.frame + spec.startFrame, path: item.path }));
  }

  const result: RenderJobResult = {
    jobId,
    output: finalPath,
    startFrame: spec.startFrame,
    endFrame: spec.endFrame,
    frameCount,
    attempts,
    recovered: attempts.length > 1,
    checkpointPath,
    outputVerification: last.validation as ArtifactReport & { verified: true },
    finalStatus: { state: 'COMPLETED', reliable: true, progress: 100 },
    ...(inspectionFrames ? { inspectionFrames } : {}),
    reportPath,
    durationMs: deps.now() - started,
  };
  await finish({ ok: true, output: finalPath, recovered: result.recovered, validation: { verified: true, checks: last.validation!.checks } });
  return result;
}

/**
 * Opt-in fallback: renders consecutive supervised segments and concatenates
 * them losslessly, then validates the joined file as one artifact.
 */
export async function runSegmentedRender(spec: RenderJobSpec, segmentFrames: number, deps: RenderPipelineDeps = defaultRenderPipelineDeps()): Promise<RenderJobResult & { segments: RenderJobResult[] }> {
  const segments: RenderJobResult[] = [];
  const stem = spec.fileName.replace(/\.mp4$/i, '');
  let checkpointPath = spec.checkpointPath;
  for (let start = spec.startFrame, index = 0; start <= spec.endFrame; start += segmentFrames, index += 1) {
    const end = Math.min(spec.endFrame, start + segmentFrames - 1);
    const segment = await runSupervisedRender({ ...spec, startFrame: start, endFrame: end, fileName: `${stem}.part-${String(index).padStart(3, '0')}`, checkpointPath, inspectionFrames: 0, sampleFrames: spec.sampleFrames?.filter((frame) => frame >= start && frame <= end) }, deps);
    checkpointPath = segment.checkpointPath ?? checkpointPath;
    segments.push(segment);
  }
  const finalPath = path.join(spec.outputDirectory, `${stem}.mp4`);
  const list = path.join(spec.outputDirectory, '.cavalry-mcp', `${stem}-concat-${process.pid}.txt`);
  await fs.writeFile(list, `${segments.map((segment) => `file '${segment.output.replace(/'/g, "'\\''")}'`).join('\n')}\n`, 'utf8');
  await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', finalPath]);
  const frameCount = spec.endFrame - spec.startFrame + 1;
  const report = await deps.validate(finalPath, {
    codec: spec.codec ?? 'h264', width: spec.width, height: spec.height, fps: spec.fps, frameCount,
    sampleFrames: spec.sampleFrames?.map((frame) => frame - spec.startFrame), allowBlankFrames: spec.allowBlankFrames ?? 0, allowStaticContent: spec.allowStaticContent,
  });
  await Promise.all([fs.rm(list, { force: true }), ...segments.map((segment) => fs.rm(segment.output, { force: true }))]);
  if (!report.verified) {
    throw new CavalryError({ code: 'RENDER_OUTPUT_INVALID', message: `Concatenated render failed validation: ${report.failures.join(', ')}`, operation: 'render', diagnostics: { checks: report.checks.filter((item) => !item.ok) } });
  }
  const first = segments[0];
  return {
    ...first,
    output: finalPath,
    startFrame: spec.startFrame,
    endFrame: spec.endFrame,
    frameCount,
    attempts: segments.flatMap((segment) => segment.attempts),
    recovered: segments.some((segment) => segment.recovered),
    outputVerification: report as ArtifactReport & { verified: true },
    segments,
  };
}
