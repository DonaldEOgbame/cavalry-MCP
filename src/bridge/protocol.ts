import { CavalryErrorDetails } from '../mcp/errors.js';

export const BRIDGE_PROTOCOL_VERSION = 2;
export const SUPPORTED_BRIDGE_PROTOCOL_VERSIONS = [BRIDGE_PROTOCOL_VERSION] as const;

export interface AffectedLayer {
  uuid: string;
  layerId: string;
  name?: string;
  type?: string;
}

export interface BridgeRequest<TParams = Record<string, unknown>> {
  protocolVersion: number;
  clientCapabilities: string[];
  id: string;
  sessionId: string;
  token: string;
  op: string;
  params: TParams;
  callbackUrl?: string;
  responseFile?: string;
  timestamp: number;
  /** Absolute time after which the bridge must not execute this request. */
  deadlineAt?: number;
  /** Highest bridge incident sequence already journaled by this client. */
  ackIncidentSeq?: number;
}

export interface BridgeIncidentContext {
  at: number;
  correlation: 'active' | 'recent' | 'none';
  request: {
    requestId: string;
    sessionId: string;
    op: string;
    startedAt: number;
    ageMs: number;
    batchId?: string;
    batchStep?: { index: number; id: string; op: string };
    endedAt?: number;
  } | null;
  host: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BridgeIncident {
  incidentId: string;
  kind: 'javascript.error' | 'callback.exception' | 'handler.exception' | 'render.exception' | 'attribute.invalid_read' | 'bridge.dispatch' | 'bridge.serialization' | string;
  category?: string;
  source: string;
  fingerprint: string;
  error: { name: string; message: string; stack: string; fileName?: string; lineNumber?: number; columnNumber?: number };
  firstSeen: number;
  lastSeen: number;
  count: number;
  firstContext: BridgeIncidentContext;
  lastContext: BridgeIncidentContext;
  updatedSeq: number;
}

export interface BridgeStatus {
  bridgeVersion: string;
  protocolVersion: number;
  bridgeCapabilities: string[];
  bridgeInstanceId: string;
  now: number;
  busy: boolean;
  activeRequest: BridgeIncidentContext['request'];
  lastCompletedRequest: BridgeIncidentContext['request'];
  activeRender: (Record<string, unknown> & { itemId: string; startedAt: number; ageMs: number }) | null;
  lastRender: Record<string, unknown> | null;
  deferredPosts: number;
  deferredTotal: number;
  appState: string;
  sceneRevision: number;
  incidentSeq: number;
  incidentCount: number;
  lastIncidentAt: number | null;
  sessions: Array<{ sessionId: string; requests: number; rawScriptRequests: number; rejected: number; expired?: number; firstSeen: number; lastSeen: number; ops: Record<string, number> }>;
  rejectedUnauthenticated: number;
  rejectedMalformed: number;
  /** Attribute-read accounting from the bridge capability registry. */
  attributes?: AttributeHygieneMetrics;
  capabilities?: { cavalryVersion: string; cachedTypes: number; types: Array<{ key: string; type: string; attributeCount: number; uuid: boolean | null }> };
}

export interface AttributeHygieneMetrics {
  attributeReadRequests: number;
  validAttributeReads: number;
  /** Reads the registry allowed that Cavalry still rejected. Must be 0. */
  invalidAttributeReads: number;
  unsupportedReadsAvoided: number;
  trustedReads: number;
  capabilityCacheHits: number;
  capabilityCacheMisses: number;
  attributeEnumerations: number;
  instanceAttributeChecks: number;
  uuidLookups: number;
  uuidCacheHits: number;
  identitiesWithoutUuid: number;
  nodeInspections: number;
  summaryInspections: number;
  detailedInspections: number;
  targetedInspections: number;
  keyframeApiCalls: number;
  graphOperations: number;
  eventEnrichmentReads: number;
  eventNotificationsWithoutReads: number;
}

export interface BridgeResponse<TResult = unknown> {
  protocolVersion?: number;
  bridgeCapabilities?: string[];
  id: string;
  token?: string;
  ok: boolean;
  operation: string;
  result?: TResult;
  affected?: AffectedLayer[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  warnings?: string[];
  durationMs: number;
  error?: CavalryErrorDetails;
  sceneRevision?: number;
  bridgeInstanceId?: string;
  incidentSeq?: number;
  incidents?: BridgeIncident[];
}

export interface BatchOperation {
  id: string;
  op: string;
  params: Record<string, unknown>;
  saveAs?: string; // e.g. "$headline"
}

export interface BatchRequestParams {
  operations: BatchOperation[];
  stopOnError?: boolean;
  expectedRevision?: number;
  transactional?: boolean;
  verify?: boolean;
  operationTimeoutMs?: number;
  /** Correlates bridge incidents with the compiler batch that caused them. */
  batchId?: string;
}

export interface BatchStepResult {
  id: string;
  op: string;
  ok: boolean;
  saveAs?: string;
  result?: unknown;
  verification?: { verified: boolean; details?: string };
  error?: CavalryErrorDetails;
  durationMs: number;
}

export interface BatchResult {
  allOk: boolean;
  stepResults: BatchStepResult[];
  symbols: Record<string, unknown>;
  durationMs: number;
  rolledBack?: boolean;
}
