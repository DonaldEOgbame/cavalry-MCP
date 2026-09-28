import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bridgeClient } from '../bridge/client.js';
import type { BridgeStatus } from '../bridge/protocol.js';
import { CavalryError } from '../mcp/errors.js';
import { classifyHostState, DEFAULT_HOST_THRESHOLDS, HostAssessment, HostSignals, HostThresholds, StatusProbe } from './host-state.js';
import { DIALOG_CLASS_KINDS, incidentJournal } from './incidents.js';

const execFileAsync = promisify(execFile);

export interface SupervisedRender {
  jobId: string;
  startedAt: number;
  lastProgressAt: number | null;
  stallAfterMs: number;
}

/** Renders currently supervised by this MCP process (updated by the render pipeline). */
export const supervisedRenders = new Map<string, SupervisedRender>();

export interface HostProbeDeps {
  now(): number;
  ping(): Promise<boolean>;
  status(timeoutMs: number): Promise<BridgeStatus>;
  processRunning(): Promise<boolean | null>;
  errorDialogVisible(): Promise<boolean | null>;
  inFlight(): HostSignals['inFlight'];
  supervisedRenders(): HostSignals['supervisedRenders'];
  dialogIncidentTimes(): number[];
  lastScriptResponseAt(): number | null;
}

export async function cavalryProcessRunning(): Promise<boolean | null> {
  const name = process.env.CAVALRY_PROCESS_NAME || 'Cavalry';
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('/usr/bin/pgrep', ['-x', name], { timeout: 3_000 });
      return true;
    }
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH'], { timeout: 5_000 });
      return stdout.toLowerCase().includes(`${name.toLowerCase()}.exe`);
    }
    return null;
  } catch (error) {
    // pgrep exits 1 when nothing matches; anything else means "cannot tell".
    return (error as { code?: unknown }).code === 1 ? false : null;
  }
}

/**
 * macOS Accessibility probe for a visible script-error dialog. Opt-in because
 * it needs Accessibility permission (CAVALRY_UI_DRIVER or CAVALRY_DIALOG_PROBE).
 */
export async function cavalryErrorDialogVisible(): Promise<boolean | null> {
  if (process.platform !== 'darwin') return null;
  if (process.env.CAVALRY_UI_DRIVER !== 'true' && process.env.CAVALRY_DIALOG_PROBE !== 'true') return null;
  try {
    const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e',
      'tell application "System Events" to if exists process "Cavalry" then get name of every window of process "Cavalry"',
    ], { timeout: 3_000 });
    return /javascript error|script error/i.test(stdout);
  } catch {
    return null;
  }
}

export function defaultHostProbeDeps(): HostProbeDeps {
  return {
    now: () => Date.now(),
    ping: () => bridgeClient.ping(),
    status: async (timeoutMs) => (await bridgeClient.send<BridgeStatus>('bridge_status', {}, timeoutMs)).result!,
    processRunning: cavalryProcessRunning,
    errorDialogVisible: cavalryErrorDialogVisible,
    inFlight: () => bridgeClient.inFlight().map(({ op, ageMs, timeoutMs }) => ({ op, ageMs, timeoutMs })),
    supervisedRenders: () => [...supervisedRenders.values()],
    dialogIncidentTimes: () => incidentJournal.list({ kinds: [...DIALOG_CLASS_KINDS] }).map((item) => item.lastSeen),
    lastScriptResponseAt: () => bridgeClient.transportStats().lastSuccessAt,
  };
}

async function probeStatus(deps: HostProbeDeps, timeoutMs: number): Promise<StatusProbe> {
  const started = deps.now();
  try {
    const status = await deps.status(timeoutMs);
    return { ok: true, latencyMs: deps.now() - started, status };
  } catch (error) {
    const code = error instanceof CavalryError ? error.code : undefined;
    const failure = code === 'BRIDGE_TIMEOUT' ? 'timeout'
      : code === 'BRIDGE_OFFLINE' ? 'unreachable'
      : code === 'UNSUPPORTED_OPERATION' ? 'unsupported'
      : 'error';
    return { ok: false, latencyMs: deps.now() - started, failure, message: error instanceof Error ? error.message : String(error) };
  }
}

export interface HostProbeResult extends HostAssessment {
  probedAt: string;
  probeMs: number;
  /** Raw bridge status when the probe was answered. */
  bridgeStatus?: BridgeStatus;
}

export async function probeHost(options: { deps?: HostProbeDeps; statusTimeoutMs?: number; thresholds?: HostThresholds } = {}): Promise<HostProbeResult> {
  const deps = options.deps ?? defaultHostProbeDeps();
  const started = deps.now();
  // Snapshot MCP-side state before the probe adds its own in-flight request.
  const inFlight = deps.inFlight();
  const renders = deps.supervisedRenders();
  const lastScriptResponseAt = deps.lastScriptResponseAt();
  const [transportReachable, processRunning, errorDialogVisible] = await Promise.all([
    deps.ping(), deps.processRunning(), deps.errorDialogVisible(),
  ]);
  const statusProbe: StatusProbe = transportReachable
    ? await probeStatus(deps, options.statusTimeoutMs ?? 3_000)
    : { ok: false, latencyMs: 0, failure: 'unreachable' };
  const assessment = classifyHostState({
    now: deps.now(),
    processRunning,
    transportReachable,
    statusProbe,
    errorDialogVisible,
    inFlight,
    supervisedRenders: renders,
    dialogClassIncidentTimes: deps.dialogIncidentTimes(),
    lastScriptResponseAt,
  }, options.thresholds ?? DEFAULT_HOST_THRESHOLDS);
  return { ...assessment, probedAt: new Date(started).toISOString(), probeMs: deps.now() - started, ...(statusProbe.ok ? { bridgeStatus: statusProbe.status } : {}) };
}

/** Polls until the host is idle, or returns the last non-idle assessment. */
export async function waitForIdleHost(options: { timeoutMs: number; intervalMs?: number; deps?: HostProbeDeps; sleep?: (ms: number) => Promise<void> }): Promise<HostProbeResult> {
  const deps = options.deps ?? defaultHostProbeDeps();
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = deps.now() + options.timeoutMs;
  let last = await probeHost({ deps });
  while (last.state !== 'idle' && !last.recoveryRecommended && deps.now() < deadline) {
    await sleep(options.intervalMs ?? 1_000);
    last = await probeHost({ deps });
  }
  return last;
}
