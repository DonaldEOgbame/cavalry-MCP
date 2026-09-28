import type { BridgeStatus } from '../bridge/protocol.js';

/**
 * Distinguishes the ways Cavalry can fail to answer, instead of collapsing
 * all of them into a timeout.
 */
export type HostState =
  | 'idle'
  | 'busy'
  | 'rendering'
  | 'wedged'
  | 'bridge_disconnected'
  | 'error_dialog_active'
  | 'cavalry_not_running';

export type StatusProbe =
  | { ok: true; latencyMs: number; status: BridgeStatus }
  | { ok: false; latencyMs: number; failure: 'timeout' | 'unreachable' | 'unsupported' | 'error'; message?: string };

export interface HostSignals {
  now: number;
  /** null when the platform cannot tell (Linux CI, missing pgrep, …). */
  processRunning: boolean | null;
  /** Any HTTP answer from the bridge's WebServer. */
  transportReachable: boolean;
  statusProbe: StatusProbe;
  /** Accessibility probe for a visible error dialog; null when not enabled. */
  errorDialogVisible: boolean | null;
  /** Requests this MCP process is still waiting on. */
  inFlight: Array<{ op: string; ageMs: number; timeoutMs: number }>;
  /** Renders this MCP process is supervising. */
  supervisedRenders: Array<{ jobId: string; startedAt: number; lastProgressAt: number | null; stallAfterMs: number }>;
  /** Times of dialog-class incidents (javascript.error / callback.exception). */
  dialogClassIncidentTimes: number[];
  /** Last time the script host answered any request. */
  lastScriptResponseAt: number | null;
}

export interface HostThresholds {
  /** A non-render operation older than this is considered wedged. */
  operationWedgeMs: number;
  /** A JS error this close before the host went silent implicates a dialog. */
  dialogCorrelationMs: number;
}

export const DEFAULT_HOST_THRESHOLDS: HostThresholds = {
  operationWedgeMs: 5 * 60 * 1000,
  dialogCorrelationMs: 30_000,
};

export interface HostAssessment {
  state: HostState;
  /** confirmed: observed directly. inferred: deduced from indirect signals. */
  confidence: 'confirmed' | 'inferred';
  reasons: string[];
  /** Safe to start a new scene mutation or render right now. */
  ready: boolean;
  /** Clean-host recovery (restart) is the appropriate response. */
  recoveryRecommended: boolean;
  attention: string[];
  evidence: Record<string, unknown>;
}

const PROBE_OPS = new Set(['cavalry_ping', 'bridge_status', 'diagnostics_incidents', 'cavalry_health']);

function assessment(state: HostState, confidence: HostAssessment['confidence'], reasons: string[], attention: string[], evidence: Record<string, unknown>): HostAssessment {
  return {
    state,
    confidence,
    reasons,
    ready: state === 'idle',
    recoveryRecommended: state === 'wedged' || state === 'error_dialog_active' || state === 'bridge_disconnected' || state === 'cavalry_not_running',
    attention,
    evidence,
  };
}

function stalledRender(signals: HostSignals): HostSignals['supervisedRenders'][number] | undefined {
  return signals.supervisedRenders.find((render) => signals.now - (render.lastProgressAt ?? render.startedAt) > render.stallAfterMs);
}

export function classifyHostState(signals: HostSignals, thresholds: HostThresholds = DEFAULT_HOST_THRESHOLDS): HostAssessment {
  const attention: string[] = [];
  const recentDialogIncident = signals.dialogClassIncidentTimes.filter((time) => signals.now - time <= thresholds.dialogCorrelationMs);
  if (recentDialogIncident.length) attention.push('recent_javascript_error');
  const evidence: Record<string, unknown> = {
    processRunning: signals.processRunning,
    transportReachable: signals.transportReachable,
    statusProbe: signals.statusProbe.ok ? { ok: true, latencyMs: signals.statusProbe.latencyMs } : signals.statusProbe,
    errorDialogVisible: signals.errorDialogVisible,
    inFlight: signals.inFlight,
    supervisedRenders: signals.supervisedRenders.length,
  };

  if (!signals.transportReachable) {
    if (signals.processRunning === false) return assessment('cavalry_not_running', 'confirmed', ['Cavalry process is not running'], attention, evidence);
    return assessment('bridge_disconnected', signals.processRunning === true ? 'confirmed' : 'inferred', [
      signals.processRunning === true ? 'Cavalry is running but the bridge WebServer is not listening' : 'Bridge WebServer is not listening',
    ], attention, evidence);
  }

  if (signals.errorDialogVisible === true) {
    return assessment('error_dialog_active', 'confirmed', ['A Cavalry error dialog is visible'], attention, evidence);
  }

  const stalled = stalledRender(signals);

  if (signals.statusProbe.ok) {
    const status = signals.statusProbe.status;
    evidence.bridge = {
      bridgeInstanceId: status.bridgeInstanceId,
      busy: status.busy,
      activeRequest: status.activeRequest,
      activeRender: status.activeRender,
      deferredPosts: status.deferredPosts,
      incidentSeq: status.incidentSeq,
    };
    if (stalled) {
      return assessment('wedged', 'inferred', [`Render ${stalled.jobId} made no output progress for ${signals.now - (stalled.lastProgressAt ?? stalled.startedAt)}ms`], attention, evidence);
    }
    if (status.activeRender) return assessment('rendering', 'confirmed', [`Render item ${status.activeRender.itemId} is active for ${status.activeRender.ageMs}ms`], attention, evidence);
    if (signals.supervisedRenders.length) return assessment('rendering', 'inferred', ['A supervised render is in progress (the native call has returned; output is still being written)'], attention, evidence);
    if (status.busy && status.activeRequest) {
      if (status.activeRequest.ageMs > thresholds.operationWedgeMs) {
        return assessment('wedged', 'inferred', [`Operation ${status.activeRequest.op} has been executing for ${status.activeRequest.ageMs}ms`], attention, evidence);
      }
      return assessment('busy', 'confirmed', [`Executing ${status.activeRequest.op} for ${status.activeRequest.ageMs}ms`], attention, evidence);
    }
    if (status.deferredPosts > 0) return assessment('busy', 'confirmed', [`${status.deferredPosts} request(s) queued behind the previous operation`], attention, evidence);
    return assessment('idle', 'confirmed', ['Bridge answered and no operation or render is active'], attention, evidence);
  }

  if (signals.statusProbe.failure === 'unsupported') {
    // The script host answered, just without status support: responsive.
    attention.push('bridge_predates_status_probe');
    if (stalled) return assessment('wedged', 'inferred', [`Render ${stalled.jobId} made no output progress`], attention, evidence);
    if (signals.supervisedRenders.length) return assessment('rendering', 'inferred', ['A supervised render is in progress'], attention, evidence);
    return assessment('idle', 'inferred', ['Bridge answered (status probe unsupported by this bridge version)'], attention, evidence);
  }

  // Transport is up but the script host did not answer the status probe.
  const lastAnswer = signals.lastScriptResponseAt;
  const silentSince = lastAnswer ?? signals.now;
  const jsErrorBeforeSilence = signals.dialogClassIncidentTimes.some((time) => time <= signals.now && silentSince - time <= thresholds.dialogCorrelationMs);
  if (jsErrorBeforeSilence) {
    return assessment('error_dialog_active', 'inferred', ['The script host stopped answering shortly after a JavaScript error was captured'], attention, evidence);
  }
  if (stalled) {
    return assessment('wedged', 'inferred', [`Render ${stalled.jobId} is unresponsive and has made no output progress`], attention, evidence);
  }
  const renderCall = signals.inFlight.find((request) => request.op === 'render_start' || request.op === 'render_start_all');
  if (renderCall || signals.supervisedRenders.length) {
    return assessment('rendering', 'inferred', ['A render owns the script host (status probe unanswered while a supervised render is running)'], attention, evidence);
  }
  const working = signals.inFlight.filter((request) => !PROBE_OPS.has(request.op));
  const withinDeadline = working.filter((request) => request.ageMs < Math.max(request.timeoutMs, 1));
  if (withinDeadline.length) {
    return assessment('busy', 'inferred', [`Waiting on ${withinDeadline.map((request) => request.op).join(', ')}`], attention, evidence);
  }
  return assessment('wedged', 'inferred', [
    working.length ? `Script host silent and ${working.map((request) => request.op).join(', ')} exceeded its deadline` : 'Script host silent with no operation in flight',
  ], attention, evidence);
}
