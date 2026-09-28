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
