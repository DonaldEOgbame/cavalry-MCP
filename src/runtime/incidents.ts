import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BridgeIncident } from '../bridge/protocol.js';
import { userDataDirectory } from '../utils/paths.js';
import { currentToolContext, ToolCallContext } from './context.js';

/**
 * Kinds that correspond to errors Cavalry would otherwise surface as a
 * "JavaScript Error" dialog. Release gates require zero of these.
 */
export const DIALOG_CLASS_KINDS = ['javascript.error', 'callback.exception'] as const;

export type IncidentSeverity = 'error' | 'warning' | 'info';

/**
 * Diagnostic categories. Capability discovery is deliberately absent: the
 * bridge no longer discovers capabilities by provoking failures.
 */
export type DiagnosticCategory =
  | 'invalid_attribute'
  | 'invalid_graph_port'
  | 'invalid_keyframe_operation'
  | 'bridge_exception'
  | 'javascript_exception'
  | 'render_error'
  | 'timeout'
  | 'authentication_error'
  | 'host_unavailable'
  | 'unknown';

export function categorizeFailure(code: string | undefined, message = ''): DiagnosticCategory {
  switch (code) {
    case 'ATTRIBUTE_NOT_FOUND': case 'ATTRIBUTE_READ_ONLY': return 'invalid_attribute';
    case 'INVALID_CONNECTION': case 'CONNECTION_CONFLICT': return 'invalid_graph_port';
    case 'BRIDGE_TIMEOUT': case 'REQUEST_EXPIRED': case 'HOST_BUSY': return 'timeout';
    case 'BRIDGE_AUTH_FAILED': case 'BRIDGE_PROTOCOL_MISMATCH': case 'REPLAYED_REQUEST': return 'authentication_error';
    case 'BRIDGE_OFFLINE': case 'HOST_WEDGED': case 'HOST_ERROR_DIALOG': case 'HOST_RECOVERY_FAILED': return 'host_unavailable';
    case 'RENDER_FAILED': case 'RENDER_STALLED': case 'RENDER_OUTPUT_INVALID': return 'render_error';
  }
  if (/Attribute not found/i.test(message)) return 'invalid_attribute';
  if (/keyframe/i.test(message)) return 'invalid_keyframe_operation';
  if (code === 'CAVALRY_ERROR' || code === 'INTERNAL_ERROR') return 'bridge_exception';
  return 'unknown';
}

function categoryForBridgeKind(kind: string, message: string, reported?: string): DiagnosticCategory {
  if (reported) return reported as DiagnosticCategory;
  if (kind === 'attribute.invalid_read') return 'invalid_attribute';
  if (kind === 'javascript.error' || kind === 'callback.exception') return 'javascript_exception';
  if (kind === 'render.exception') return 'render_error';
  return categorizeFailure(undefined, message) === 'unknown' ? 'bridge_exception' : categorizeFailure(undefined, message);
}

export interface JournalIncident {
  key: string;
  origin: 'bridge' | 'mcp';
  incidentId: string;
  kind: string;
  category: DiagnosticCategory;
  severity: IncidentSeverity;
  source: string;
  message: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  bridgeInstanceId?: string;
  mcpSessionId: string;
  /** MCP tool call that issued the correlated bridge request, when known. */
  toolCall?: { callId: string; tool: string; op?: string };
  bridge?: BridgeIncident;
  context?: Record<string, unknown>;
}

function severityFor(kind: string): IncidentSeverity {
  if (kind === 'handler.exception') return 'warning';
  if (kind.startsWith('mcp.info.')) return 'info';
  return 'error';
}

export interface IncidentQuery {
  sinceMs?: number;
  kinds?: string[];
  callId?: string;
  severity?: IncidentSeverity[];
  limit?: number;
}

export class IncidentJournal {
  readonly filePath: string;
  readonly mcpSessionId: string;
  private readonly entries = new Map<string, JournalIncident>();
  private readonly requestContexts = new Map<string, ToolCallContext & { op: string }>();
  private writeFailed = false;

  constructor(options: { filePath?: string; mcpSessionId?: string } = {}) {
    this.mcpSessionId = options.mcpSessionId ?? crypto.randomUUID();
    this.filePath = options.filePath
      ?? process.env.CAVALRY_INCIDENT_LOG
      ?? path.join(userDataDirectory(), 'incidents', `${new Date().toISOString().slice(0, 10)}-${this.mcpSessionId}.jsonl`);
  }

  /** Remembers which tool call issued a bridge request (bounded). */
  noteRequest(requestId: string, op: string, context = currentToolContext()): void {
    if (!context) return;
    this.requestContexts.set(requestId, { ...context, op });
    if (this.requestContexts.size > 1000) {
      const oldest = this.requestContexts.keys().next().value;
      if (oldest) this.requestContexts.delete(oldest);
    }
  }

  ingest(incidents: BridgeIncident[], bridgeInstanceId?: string): JournalIncident[] {
    const changed: JournalIncident[] = [];
    for (const incident of incidents) {
      const key = `${bridgeInstanceId ?? 'bridge'}:${incident.incidentId}`;
      const previous = this.entries.get(key);
      if (previous && previous.count === incident.count && previous.lastSeen === incident.lastSeen) continue;
      const requestId = incident.lastContext?.request?.requestId ?? incident.firstContext?.request?.requestId;
      const call = requestId ? this.requestContexts.get(requestId) : undefined;
      const entry: JournalIncident = {
        key,
        origin: 'bridge',
        incidentId: incident.incidentId,
        kind: incident.kind,
        category: categoryForBridgeKind(incident.kind, incident.error?.message ?? '', (incident as { category?: string }).category),
        severity: severityFor(incident.kind),
        source: incident.source,
        message: incident.error?.message ?? '',
        count: incident.count,
        firstSeen: incident.firstSeen,
        lastSeen: incident.lastSeen,
        bridgeInstanceId,
        mcpSessionId: this.mcpSessionId,
        toolCall: call ? { callId: call.callId, tool: call.tool, op: call.op } : previous?.toolCall,
        bridge: incident,
      };
      this.entries.set(key, entry);
      this.append(entry);
      changed.push(entry);
    }
    return changed;
  }

  /** Records an MCP-side incident (timeouts, render failures, recoveries). */
  record(kind: string, message: string, context: Record<string, unknown> = {}): JournalIncident {
    const now = Date.now();
    const call = currentToolContext();
    const entry: JournalIncident = {
      key: `mcp:${crypto.randomUUID()}`,
      origin: 'mcp',
      incidentId: `mcp_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      kind,
      category: kind.startsWith('mcp.info.') ? 'unknown' : categorizeFailure(typeof context.code === 'string' ? context.code : undefined, message),
      severity: severityFor(kind),
      source: call?.tool ?? 'mcp',
      message,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      mcpSessionId: this.mcpSessionId,
      toolCall: call ? { callId: call.callId, tool: call.tool } : undefined,
      context,
    };
    this.entries.set(entry.key, entry);
    this.append(entry);
    return entry;
  }

  list(query: IncidentQuery = {}): JournalIncident[] {
    const items = [...this.entries.values()]
      .filter((item) => query.sinceMs === undefined || item.lastSeen >= query.sinceMs)
      .filter((item) => !query.kinds || query.kinds.includes(item.kind))
      .filter((item) => !query.callId || item.toolCall?.callId === query.callId)
      .filter((item) => !query.severity || query.severity.includes(item.severity))
      .sort((a, b) => a.lastSeen - b.lastSeen);
    return query.limit ? items.slice(-query.limit) : items;
  }

  summary(sinceMs?: number): Record<string, unknown> {
    const items = this.list({ sinceMs });
    const byKind: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const item of items) {
      byKind[item.kind] = (byKind[item.kind] ?? 0) + item.count;
      if (item.severity !== 'info') byCategory[item.category] = (byCategory[item.category] ?? 0) + item.count;
    }
    const dialogClass = items.filter((item) => (DIALOG_CLASS_KINDS as readonly string[]).includes(item.kind));
    return {
      journalPath: this.filePath,
      mcpSessionId: this.mcpSessionId,
      distinct: items.length,
      occurrences: items.reduce((sum, item) => sum + item.count, 0),
      errors: items.filter((item) => item.severity === 'error').length,
      dialogClassOccurrences: dialogClass.reduce((sum, item) => sum + item.count, 0),
      byKind,
      byCategory,
      latest: items.slice(-5).map((item) => ({ incidentId: item.incidentId, kind: item.kind, message: item.message, count: item.count, lastSeen: new Date(item.lastSeen).toISOString(), toolCall: item.toolCall })),
      persistenceHealthy: !this.writeFailed,
    };
  }

  /** Test helper: forget in-memory state without touching the file. */
  reset(): void {
    this.entries.clear();
    this.requestContexts.clear();
  }

  private append(entry: JournalIncident): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(this.filePath, `${JSON.stringify({ ...entry, journaledAt: new Date().toISOString() })}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // The journal is diagnostic; never let a full disk fail a tool call.
      this.writeFailed = true;
    }
  }
}

/** Reads a JSONL journal (latest line per key wins). Used by gates and harnesses. */
export function readIncidentJournal(filePath: string): JournalIncident[] {
  if (!fs.existsSync(filePath)) return [];
  const latest = new Map<string, JournalIncident>();
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as JournalIncident;
      latest.set(entry.key, entry);
    } catch {}
  }
  return [...latest.values()];
}

export const incidentJournal = new IncidentJournal();
