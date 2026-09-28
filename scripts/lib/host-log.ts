import fs from 'node:fs';

/**
 * Captures what Cavalry appends to its log file between two points, so a run
 * can be judged by the host's own log rather than by bridge self-reporting.
 * The log path is host-specific and must be supplied (--cavalry-log or
 * CAVALRY_LOG_PATH); nothing is filtered or suppressed.
 */
export interface HostLogWindow {
  path: string;
  startOffset: number;
}

export interface HostLogSummary {
  path: string;
  bytes: number;
  lines: number;
  errorLines: number;
  attributeNotFound: number;
  families: Array<{ family: string; count: number }>;
  firstNonAttributeErrors: string[];
}

export function openHostLogWindow(logPath: string | undefined): HostLogWindow | null {
  if (!logPath) return null;
  const size = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  return { path: logPath, startOffset: size };
}

export function summarizeHostLog(text: string, logPath = ''): HostLogSummary {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const families = new Map<string, number>();
  let attributeNotFound = 0;
  const others: string[] = [];
  let errorLines = 0;
  for (const line of lines) {
    const isError = /error|exception|not found|failed/i.test(line);
    if (isError) errorLines += 1;
    const match = line.match(/Attribute not found:\s*([A-Za-z]+)#\d+\.(\S+)/);
    if (match) {
      attributeNotFound += 1;
      const family = `${match[1]}.${match[2].replace(/\.\d+/g, '.N')}`;
      families.set(family, (families.get(family) ?? 0) + 1);
    } else if (isError && others.length < 20) {
      others.push(line.slice(0, 300));
    }
  }
  return {
    path: logPath,
    bytes: Buffer.byteLength(text),
    lines: lines.length,
    errorLines,
    attributeNotFound,
    families: [...families.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([family, count]) => ({ family, count })),
    firstNonAttributeErrors: others,
  };
}

export function closeHostLogWindow(window: HostLogWindow | null): HostLogSummary | null {
  if (!window) return null;
  if (!fs.existsSync(window.path)) return summarizeHostLog('', window.path);
  const size = fs.statSync(window.path).size;
  const start = size < window.startOffset ? 0 : window.startOffset;
  const descriptor = fs.openSync(window.path, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    fs.readSync(descriptor, buffer, 0, buffer.length, start);
    return summarizeHostLog(buffer.toString('utf8'), window.path);
  } finally {
    fs.closeSync(descriptor);
  }
}

/** Numeric difference of two counter snapshots (after - before). */
export function counterDelta(before: Record<string, number> | null | undefined, after: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!after) return null;
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - Number(before?.[key] ?? 0)]));
}
