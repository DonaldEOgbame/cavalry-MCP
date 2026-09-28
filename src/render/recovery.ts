import { stat } from 'node:fs/promises';
import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { metadataCache } from '../utils/cache.js';
import { HostProbeResult, probeHost } from '../runtime/host-probe.js';
import { defaultProcessControl, ProcessControl } from '../runtime/process-control.js';

/**
 * Clean-host recovery, below the agent: verify checkpoint → terminate Cavalry
 * (escalating to SIGKILL if a dialog blocks quitting) → relaunch → reconnect
 * the bridge → reopen the checkpoint → verify structure → confirm idle.
 */
export interface RecoveryInput {
  checkpointPath: string;
  reason: string;
  expectedMinimumLayers?: number;
  compId?: string;
}

export interface RecoveryStep {
  step: 'checkpoint' | 'terminate' | 'launch' | 'bridge' | 'reopen' | 'verify' | 'health';
  ok: boolean;
  durationMs: number;
  detail?: Record<string, unknown> | string;
}

export interface RecoveryReport {
  ok: boolean;
  attempted: boolean;
  reason: string;
  unavailableReason?: string;
  steps: RecoveryStep[];
  durationMs: number;
  compId?: string;
  hostAfter?: Pick<HostProbeResult, 'state' | 'confidence' | 'reasons'>;
}

export interface RecoveryDeps {
  process: ProcessControl;
  now(): number;
  sleep(ms: number): Promise<void>;
  fileSize(path: string): Promise<number | null>;
  bridgeListening(): Promise<boolean>;
  bridgeHealthy(): Promise<boolean>;
  openScene(path: string): Promise<void>;
  layerCount(): Promise<number>;
  activeComp(): Promise<string | null>;
  setActiveComp(compId: string): Promise<boolean>;
  probe(): Promise<HostProbeResult>;
  bridgeWaitMs: number;
  activationWaitMs: number;
}

export function defaultRecoveryDeps(): RecoveryDeps {
  return {
    process: defaultProcessControl(),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fileSize: async (path) => { try { return (await stat(path)).size; } catch { return null; } },
    bridgeListening: () => bridgeClient.ping(),
    bridgeHealthy: async () => { try { return (await bridgeClient.send('cavalry_health', {}, 10_000)).ok === true; } catch { return false; } },
    openScene: async (path) => {
      identityResolver.invalidate();
      metadataCache.clear();
      await bridgeClient.send('scene_open', { path, force: true }, 180_000);
    },
    layerCount: async () => Number((await bridgeClient.send<any>('scene_inspect', { detailed: false }, 60_000)).result?.layerCount ?? 0),
    activeComp: async () => (await bridgeClient.send<any>('composition_get_active', {}, 15_000)).result?.compId ?? null,
    setActiveComp: async (compId) => { try { await bridgeClient.send('composition_set_active', { compId }, 15_000); return true; } catch { return false; } },
    probe: () => probeHost(),
    bridgeWaitMs: 20_000,
    activationWaitMs: 30_000,
  };
}

async function waitUntil(deps: RecoveryDeps, predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = deps.now() + timeoutMs;
  while (deps.now() < deadline) {
    if (await predicate()) return true;
    await deps.sleep(500);
  }
  return predicate();
}

export async function recoverCleanHost(input: RecoveryInput, deps: RecoveryDeps = defaultRecoveryDeps()): Promise<RecoveryReport> {
  const started = deps.now();
  const steps: RecoveryStep[] = [];
  const report = (ok: boolean, extra: Partial<RecoveryReport> = {}): RecoveryReport => ({ ok, attempted: true, reason: input.reason, steps, durationMs: deps.now() - started, ...extra });
  const run = async <T>(step: RecoveryStep['step'], action: () => Promise<{ ok: boolean; detail?: RecoveryStep['detail']; value?: T }>): Promise<{ ok: boolean; value?: T }> => {
    const stepStarted = deps.now();
    try {
      const outcome = await action();
      steps.push({ step, ok: outcome.ok, durationMs: deps.now() - stepStarted, ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}) });
      return outcome;
    } catch (error) {
      steps.push({ step, ok: false, durationMs: deps.now() - stepStarted, detail: error instanceof Error ? error.message : String(error) });
      return { ok: false };
    }
  };

  if (!deps.process.supported) {
    return { ok: false, attempted: false, reason: input.reason, unavailableReason: deps.process.unsupportedReason, steps, durationMs: 0 };
  }

  const checkpoint = await run('checkpoint', async () => {
    const size = await deps.fileSize(input.checkpointPath);
    return { ok: size !== null && size > 0, detail: { path: input.checkpointPath, size } };
  });
  if (!checkpoint.ok) return report(false);

  const terminated = await run('terminate', async () => {
    const result = await deps.process.terminate();
    return { ok: result.exited, detail: { ...result } };
  });
  if (!terminated.ok) return report(false);

  const launched = await run('launch', async () => { await deps.process.launch(); return { ok: true }; });
  if (!launched.ok) return report(false);

  // Cavalry usually restores the bridge window itself; fall back to the menu.
  const bridge = await run('bridge', async () => {
    if (await waitUntil(deps, () => deps.bridgeListening(), deps.bridgeWaitMs) && await deps.bridgeHealthy()) return { ok: true, detail: { activation: 'restored' } };
    const activated = await deps.process.activateBridge();
    const listening = activated && await waitUntil(deps, () => deps.bridgeListening(), deps.activationWaitMs);
    return { ok: listening && await deps.bridgeHealthy(), detail: { activation: activated ? 'menu' : 'failed' } };
  });
  if (!bridge.ok) return report(false);

  const reopened = await run('reopen', async () => { await deps.openScene(input.checkpointPath); return { ok: true, detail: { path: input.checkpointPath } }; });
  if (!reopened.ok) return report(false);

  const verified = await run<string | null>('verify', async () => {
    const layers = await deps.layerCount();
    let compId = await deps.activeComp();
    if (input.compId && compId !== input.compId && await deps.setActiveComp(input.compId)) compId = input.compId;
    const enoughLayers = input.expectedMinimumLayers === undefined || layers >= input.expectedMinimumLayers;
    return { ok: enoughLayers && Boolean(compId), value: compId, detail: { layerCount: layers, expectedMinimumLayers: input.expectedMinimumLayers ?? null, compId } };
  });
  if (!verified.ok) return report(false);

  const health = await run<HostProbeResult>('health', async () => {
    let host = await deps.probe();
    const deadline = deps.now() + deps.activationWaitMs;
    while (host.state !== 'idle' && deps.now() < deadline) {
      await deps.sleep(500);
      host = await deps.probe();
    }
    return { ok: host.state === 'idle', value: host, detail: { state: host.state, reasons: host.reasons } };
  });
  const hostAfter = health.value ? { state: health.value.state, confidence: health.value.confidence, reasons: health.value.reasons } : undefined;
  return report(health.ok, { compId: verified.value ?? undefined, hostAfter });
}
