export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  operation?: string;
  durationMs?: number;
  success?: boolean;
  message: string;
  affectedUuids?: string[];
  data?: unknown;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private level: LogLevel = 'info';
  private ringBuffer: StructuredLogEntry[] = [];
  private readonly maxBufferSize = 500;

  constructor() {
    const envLevel = process.env.CAVALRY_LOG_LEVEL?.toLowerCase();
    if (envLevel === 'debug' || envLevel === 'info' || envLevel === 'warn' || envLevel === 'error') {
      this.level = envLevel;
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  private record(entry: StructuredLogEntry) {
    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
    if (this.shouldLog(entry.level)) {
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.operation ? `[${entry.operation}] ` : ''}${entry.message}${entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : ''}`;
      if (entry.level === 'error') {
        console.error(line, entry.error ?? '');
      } else if (entry.level === 'warn') {
        console.warn(line);
      } else {
        // Standard MCP communicates on stdio; general operational logs must go to stderr
        console.error(line);
      }
    }
  }

  log(entry: Omit<StructuredLogEntry, 'timestamp'>) {
    this.record({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  debug(message: string, meta?: Partial<StructuredLogEntry>) {
    this.log({ level: 'debug', message, ...meta });
  }

  info(message: string, meta?: Partial<StructuredLogEntry>) {
    this.log({ level: 'info', message, ...meta });
  }

  warn(message: string, meta?: Partial<StructuredLogEntry>) {
    this.log({ level: 'warn', message, ...meta });
  }

  error(message: string, error?: unknown, meta?: Partial<StructuredLogEntry>) {
    const errObj = error instanceof Error
      ? { code: (error as any).code ?? 'INTERNAL_ERROR', message: error.message, stack: error.stack }
      : error
      ? { code: 'INTERNAL_ERROR', message: String(error) }
      : undefined;

    this.log({
      level: 'error',
      message,
      error: errObj,
      ...meta,
    });
  }

  getRecentLogs(limit: number = 50): StructuredLogEntry[] {
    return this.ringBuffer.slice(-Math.min(limit, this.ringBuffer.length));
  }

  clearLogs() {
    this.ringBuffer = [];
  }
}

export const logger = new Logger();
