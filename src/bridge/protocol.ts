import { CavalryErrorDetails } from '../mcp/errors.js';

export interface AffectedLayer {
  uuid: string;
  layerId: string;
  name?: string;
  type?: string;
}

export interface BridgeRequest<TParams = Record<string, unknown>> {
  id: string;
  op: string;
  params: TParams;
  callbackUrl?: string;
  responseFile?: string;
  timestamp: number;
}

export interface BridgeResponse<TResult = unknown> {
  id: string;
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
}

export interface BatchStepResult {
  id: string;
  op: string;
  ok: boolean;
  saveAs?: string;
  result?: unknown;
  error?: CavalryErrorDetails;
  durationMs: number;
}

export interface BatchResult {
  allOk: boolean;
  stepResults: BatchStepResult[];
  symbols: Record<string, unknown>;
  durationMs: number;
}
