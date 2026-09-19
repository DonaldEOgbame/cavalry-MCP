export type CavalryErrorCode =
  | 'BRIDGE_OFFLINE'
  | 'BRIDGE_TIMEOUT'
  | 'NO_ACTIVE_COMPOSITION'
  | 'LAYER_NOT_FOUND'
  | 'ATTRIBUTE_NOT_FOUND'
  | 'ATTRIBUTE_READ_ONLY'
  | 'INVALID_VALUE'
  | 'INVALID_ENUM'
  | 'TYPE_MISMATCH'
  | 'CONNECTION_CONFLICT'
  | 'INVALID_CONNECTION'
  | 'UNSUPPORTED_OPERATION'
  | 'UNSUPPORTED_LAYER'
  | 'ASSET_NOT_FOUND'
  | 'FONT_NOT_FOUND'
  | 'FILE_NOT_ALLOWED'
  | 'RENDER_FAILED'
  | 'SCENE_DIRTY'
  | 'PERMISSION_REQUIRED'
  | 'RAW_SCRIPT_DISABLED'
  | 'SYSTEM_EXEC_DISABLED'
  | 'UI_FALLBACK_REQUIRED'
  | 'CAVALRY_ERROR'
  | 'INTERNAL_ERROR';

export interface CavalryErrorDetails {
  code: CavalryErrorCode;
  message: string;
  operation?: string;
  relevantIds?: string[];
  suggestion?: string;
}

export class CavalryError extends Error {
  public readonly code: CavalryErrorCode;
  public readonly operation?: string;
  public readonly relevantIds?: string[];
  public readonly suggestion?: string;

  constructor(details: CavalryErrorDetails) {
    super(details.message);
    this.name = 'CavalryError';
    this.code = details.code;
    this.operation = details.operation;
    this.relevantIds = details.relevantIds;
    this.suggestion = details.suggestion;
    Object.setPrototypeOf(this, CavalryError.prototype);
  }

  toJSON(): CavalryErrorDetails {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      relevantIds: this.relevantIds,
      suggestion: this.suggestion,
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
