import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { userDataDirectory } from '../utils/paths.js';

/**
 * Server-side record of every MCP tool call. It is written by the server, so
 * it is authoritative regardless of which client drove the session.
 */
export interface TranscriptCall {
  type: 'call';
  seq: number;
  callId: string;
  tool: string;
  startedAt: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
  hostState?: string;
  argsDigest: string;
  argsKeys: string[];
  dryRun?: boolean;
  result?: Record<string, unknown>;
  imageCount: number;
  incidentCount: number;
}

export interface TranscriptStart {
  type: 'session';
  mcpSessionId: string;
  bridgeSessionId: string;
  startedAt: string;
  toolProfile: string;
  pid: number;
  node: string;
}

export type TranscriptLine = TranscriptCall | TranscriptStart;

/** Tools that reach the bridge below the typed production surface. */
export const LOW_LEVEL_BRIDGE_TOOLS = new Set(['cavalry_raw_script', 'cavalry_batch', 'safe_host_operation']);

const SUMMARY_KEYS = ['valid', 'applied', 'directOperations', 'imageCount', 'operationCount', 'batchCount', 'attempts', 'recovered', 'segmented', 'partial', 'startFrame', 'endFrame', 'hostState', 'state'];

export function summarizeToolResult(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const source = payload as Record<string, any>;
  const summary: Record<string, unknown> = {};
  for (const key of SUMMARY_KEYS) if (source[key] !== undefined && typeof source[key] !== 'object') summary[key] = source[key];
  if (source.finalStatus?.state) summary.finalState = source.finalStatus.state;
  if (source.outputVerification) {
    summary.outputVerified = source.outputVerification.verified === true;
    if (source.outputVerification.path) summary.outputPath = source.outputVerification.path;
  }
  if (Array.isArray(source.inspectionFrames)) summary.inspectionFrames = source.inspectionFrames.length;
  if (source.rebuilt?.scenes) summary.rebuiltScenes = source.rebuilt.scenes.length;
  return Object.keys(summary).length ? summary : undefined;
}

export class TranscriptRecorder {
  readonly filePath: string;
  private seq = 0;
  private started = false;

  constructor(private readonly mcpSessionId: string, filePath?: string) {
    this.filePath = filePath
      ?? process.env.CAVALRY_TRANSCRIPT_PATH
      ?? path.join(userDataDirectory(), 'transcripts', `${new Date().toISOString().slice(0, 10)}-${mcpSessionId}.jsonl`);
  }

  start(meta: Omit<TranscriptStart, 'type' | 'mcpSessionId' | 'startedAt' | 'pid' | 'node'>): void {
    if (this.started) return;
    this.started = true;
    this.append({ type: 'session', mcpSessionId: this.mcpSessionId, startedAt: new Date().toISOString(), pid: process.pid, node: process.version, ...meta });
  }

  record(call: Omit<TranscriptCall, 'type' | 'seq' | 'argsDigest' | 'argsKeys'> & { args: unknown }): TranscriptCall {
    const { args, ...rest } = call;
    const argsObject = args && typeof args === 'object' ? args as Record<string, unknown> : {};
    const entry: TranscriptCall = {
      type: 'call',
      seq: ++this.seq,
      ...rest,
      argsDigest: crypto.createHash('sha256').update(JSON.stringify(args ?? null)).digest('hex').slice(0, 16),
      argsKeys: Object.keys(argsObject).sort(),
      ...(typeof argsObject.dryRun === 'boolean' ? { dryRun: argsObject.dryRun } : {}),
    };
    this.append(entry);
    return entry;
  }

  private append(line: TranscriptLine): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(this.filePath, `${JSON.stringify(line)}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {}
  }
}

export function readTranscript(filePath: string): TranscriptLine[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter((line) => line.trim()).flatMap((line) => {
    try { return [JSON.parse(line) as TranscriptLine]; } catch { return []; }
  });
}

export const CANONICAL_PHASES = ['plan', 'compile', 'verify', 'preview', 'render', 'inspect', 'correct', 'rerender'] as const;
export type ProductionPhase = typeof CANONICAL_PHASES[number] | 'health' | 'save' | 'metrics' | 'knowledge' | 'bypass' | 'other';

const PLAN_TOOLS = new Set(['motion_brief_plan', 'motion_project_create', 'motion_plan']);
const COMPILE_TOOLS = new Set(['motion_project_compile', 'scene_timeline_compile', 'motion_scene_build', 'motion_scene_batch_build', 'motion_project_update', 'motion_sequence_retime', 'motion_component_apply', 'transition_sequence_apply', 'typography_system_create']);
const RENDER_TOOLS = new Set(['motion_project_render', 'render_scene_verified']);

/**
 * Maps successful, non-dry-run calls to production phases. Review before the
 * first verified render is "preview"; review (or returned frames) after it is
 * "inspect"; a verified render after a correction is "rerender".
 */
export function phasesFor(calls: TranscriptCall[]): Array<{ seq: number; tool: string; phase: ProductionPhase }> {
  const phases: Array<{ seq: number; tool: string; phase: ProductionPhase }> = [];
  let rendered = false;
  let corrected = false;
  for (const call of calls) {
    const push = (phase: ProductionPhase) => phases.push({ seq: call.seq, tool: call.tool, phase });
    if (LOW_LEVEL_BRIDGE_TOOLS.has(call.tool)) { push('bypass'); continue; }
    if (!call.ok || call.dryRun === true) continue;
    if (PLAN_TOOLS.has(call.tool)) push('plan');
    else if (COMPILE_TOOLS.has(call.tool)) push('compile');
    else if (call.tool === 'motion_project_verify') push('verify');
    else if (call.tool === 'motion_project_render_review') push(rendered ? 'inspect' : 'preview');
    else if (call.tool === 'motion_project_apply_corrections') { push('correct'); corrected = true; }
    else if (RENDER_TOOLS.has(call.tool)) {
      if (call.result?.outputVerified !== true) continue;
      push(corrected ? 'rerender' : 'render');
      rendered = true;
      if (Number(call.result?.inspectionFrames ?? 0) > 0) push('inspect');
    }
    else if (call.tool === 'cavalry_health' || call.tool === 'cavalry_ping') push('health');
    else if (call.tool.startsWith('scene_save') || call.tool === 'scene_open') push('save');
    else if (call.tool === 'motion_project_metrics') push('metrics');
    else if (call.tool.startsWith('knowledge_')) push('knowledge');
    else push('other');
  }
  return phases;
}

export interface SequenceAnalysis {
  canonical: readonly string[];
  observed: string[];
  matched: boolean;
  missing: string[];
  bypassCalls: Array<{ seq: number; tool: string }>;
  failedCalls: Array<{ seq: number; tool: string; errorCode?: string }>;
  totalCalls: number;
  wallTimeMs: number | null;
}

export function analyzeProductionSequence(lines: TranscriptLine[]): SequenceAnalysis {
  const calls = lines.filter((line): line is TranscriptCall => line.type === 'call').sort((a, b) => a.seq - b.seq);
  const phases = phasesFor(calls);
  const observed: string[] = [];
  for (const { phase } of phases) if (observed[observed.length - 1] !== phase) observed.push(phase);
  // Canonical phases must appear in order as a subsequence of what happened.
  let cursor = 0;
  const found = new Set<string>();
  for (const phase of observed) {
    if (cursor < CANONICAL_PHASES.length && phase === CANONICAL_PHASES[cursor]) {
      found.add(phase);
      cursor += 1;
    }
  }
  const first = calls[0];
  const last = calls[calls.length - 1];
  return {
    canonical: CANONICAL_PHASES,
    observed,
    matched: cursor === CANONICAL_PHASES.length,
    missing: CANONICAL_PHASES.slice(cursor),
    bypassCalls: phases.filter((item) => item.phase === 'bypass').map(({ seq, tool }) => ({ seq, tool })),
    failedCalls: calls.filter((call) => !call.ok).map(({ seq, tool, errorCode }) => ({ seq, tool, errorCode })),
    totalCalls: calls.length,
    wallTimeMs: first && last ? Date.parse(last.startedAt) + last.durationMs - Date.parse(first.startedAt) : null,
  };
}
