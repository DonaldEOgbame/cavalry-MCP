export type CavalryErrorCode =
  | 'BRIDGE_OFFLINE'
  | 'BRIDGE_TIMEOUT'
  | 'BRIDGE_AUTH_FAILED'
  | 'BRIDGE_PROTOCOL_MISMATCH'
  | 'REPLAYED_REQUEST'
  | 'OPERATION_CANCELLED'
  | 'UNSUPPORTED_CAVALRY_VERSION'
  | 'NO_ACTIVE_COMPOSITION'
  | 'LAYER_NOT_FOUND'
  | 'ATTRIBUTE_NOT_FOUND'
  | 'ATTRIBUTE_READ_ONLY'
  | 'INVALID_VALUE'
  | 'INVALID_ENUM'
  | 'TYPE_MISMATCH'
  | 'CONNECTION_CONFLICT'
  | 'EDIT_CONFLICT'
  | 'INVALID_CONNECTION'
  | 'UNSUPPORTED_OPERATION'
  | 'UNSUPPORTED_LAYER'
  | 'ASSET_NOT_FOUND'
  | 'FONT_NOT_FOUND'
  | 'FONT_RESTART_REQUIRED'
  | 'FILE_NOT_ALLOWED'
  | 'RENDER_FAILED'
  | 'SCENE_DIRTY'
  | 'PERMISSION_REQUIRED'
  | 'RAW_SCRIPT_DISABLED'
  | 'SYSTEM_EXEC_DISABLED'
  | 'UI_FALLBACK_REQUIRED'
  | 'REQUEST_EXPIRED'
  | 'HOST_BUSY'
  | 'HOST_WEDGED'
  | 'HOST_ERROR_DIALOG'
  | 'HOST_RECOVERY_FAILED'
  | 'RENDER_STALLED'
  | 'RENDER_OUTPUT_INVALID'
  | 'CAVALRY_ERROR'
  | 'INTERNAL_ERROR';

export interface CavalryErrorDetails {
  code: CavalryErrorCode;
  message: string;
  operation?: string;
  relevantIds?: string[];
  suggestion?: string;
  /** Bridge-side stack trace when the failure came from a Cavalry handler. */
  stack?: string;
  /** Bridge incident that recorded this failure, for journal correlation. */
  incidentId?: string;
  /** Classified host state observed when the failure was diagnosed. */
  hostState?: string;
  /** Structured evidence gathered while diagnosing the failure. */
  diagnostics?: Record<string, unknown>;
}

export class CavalryError extends Error {
  public readonly code: CavalryErrorCode;
  public readonly operation?: string;
  public readonly relevantIds?: string[];
  public readonly suggestion?: string;
  public readonly bridgeStack?: string;
  public readonly incidentId?: string;
  public hostState?: string;
  public diagnostics?: Record<string, unknown>;

  constructor(details: CavalryErrorDetails) {
    super(details.message);
    this.name = 'CavalryError';
    this.code = details.code;
    this.operation = details.operation;
    this.relevantIds = details.relevantIds;
    this.suggestion = details.suggestion;
    this.bridgeStack = details.stack;
    this.incidentId = details.incidentId;
    this.hostState = details.hostState;
    this.diagnostics = details.diagnostics;
    Object.setPrototypeOf(this, CavalryError.prototype);
  }

  toJSON(): CavalryErrorDetails {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      relevantIds: this.relevantIds,
      suggestion: this.suggestion,
      ...(this.bridgeStack ? { stack: this.bridgeStack } : {}),
      ...(this.incidentId ? { incidentId: this.incidentId } : {}),
      ...(this.hostState ? { hostState: this.hostState } : {}),
      ...(this.diagnostics ? { diagnostics: this.diagnostics } : {}),
    };
  }

  static fromUnknown(err: unknown, operation?: string): CavalryError {
    if (err instanceof CavalryError) {
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return new CavalryError({
        code: 'BRIDGE_OFFLINE',
        message: 'Cavalry bridge is offline or unreachable.',
        operation,
        suggestion: 'Ensure Cavalry is running with the CavalryBridge script active (Scripts > CavalryBridge).',
      });
    }
    if (message.includes('timeout') || message.includes('AbortError')) {
      return new CavalryError({
        code: 'BRIDGE_TIMEOUT',
        message: 'Operation timed out waiting for Cavalry bridge response.',
        operation,
        suggestion: 'Check if Cavalry is frozen or rendering a heavy operation.',
      });
    }
    return new CavalryError({
      code: 'CAVALRY_ERROR',
      message,
      operation,
    });
  }
}
