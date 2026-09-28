import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * External MCP harness: talks to dist/index.js over stdio exactly like a
 * production client. It never imports the bridge client and refuses tools
 * that reach the bridge below the typed surface.
 */
export const BYPASS_TOOLS = new Set(['cavalry_raw_script', 'cavalry_batch', 'safe_host_operation']);

export interface HarnessCall {
  tool: string;
  startedAt: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
  hostState?: string;
  imageCount: number;
}

export interface CallResult<T = any> extends HarnessCall {
  payload: T;
  error?: Record<string, unknown>;
  images: Array<{ data: string; mimeType: string }>;
}

export interface HarnessOptions {
  evidenceDirectory: string;
  profile?: 'core' | 'standard' | 'full';
  env?: Record<string, string>;
  clientName?: string;
}

export class McpHarness {
  readonly calls: HarnessCall[] = [];
  readonly transcriptPath: string;
  readonly incidentPath: string;

  private constructor(private readonly client: Client, private readonly transport: StdioClientTransport, evidenceDirectory: string) {
    this.transcriptPath = path.join(evidenceDirectory, 'server-transcript.jsonl');
    this.incidentPath = path.join(evidenceDirectory, 'incidents.jsonl');
  }

  static async start(options: HarnessOptions): Promise<McpHarness> {
    fs.mkdirSync(options.evidenceDirectory, { recursive: true });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve('dist/index.js')],
      cwd: process.cwd(),
      env: {
        ...process.env,
        CAVALRY_TOOL_PROFILE: options.profile ?? 'core',
        CAVALRY_ALLOW_RAW_SCRIPT: 'false',
        CAVALRY_SECURITY_TIER: 'SAFE',
        CAVALRY_TRANSCRIPT_PATH: path.join(options.evidenceDirectory, 'server-transcript.jsonl'),
        CAVALRY_INCIDENT_LOG: path.join(options.evidenceDirectory, 'incidents.jsonl'),
        ...options.env,
      } as Record<string, string>,
      stderr: 'pipe',
    });
    // Drain diagnostics so logging back-pressure cannot stall the server.
    transport.stderr?.on('data', () => {});
    const client = new Client({ name: options.clientName ?? 'cavalry-mcp-harness', version: '1.0.0' });
    await client.connect(transport);
    return new McpHarness(client, transport, options.evidenceDirectory);
  }

  async tools(): Promise<string[]> {
    return (await this.client.listTools()).tools.map((tool) => tool.name);
  }

  /** Calls a tool; tool-level failures are returned, not thrown. */
  async call<T = any>(tool: string, args: Record<string, unknown> = {}, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<CallResult<T>> {
    if (BYPASS_TOOLS.has(tool)) throw new Error(`Harness refuses ${tool}: it bypasses the typed production surface.`);
    const started = Date.now();
    let result: any;
    try {
      result = await this.client.callTool({ name: tool, arguments: args }, undefined, { timeout: options.timeoutMs ?? 60 * 60 * 1000, signal: options.signal });
    } catch (error) {
      const record: CallResult<T> = { tool, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, ok: false, errorCode: options.signal?.aborted ? 'CLIENT_ABORTED' : 'TRANSPORT_ERROR', imageCount: 0, payload: undefined as T, error: { message: error instanceof Error ? error.message : String(error) }, images: [] };
      this.calls.push(strip(record));
      return record;
    }
    const text = result.content?.find((item: any) => item.type === 'text')?.text;
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}
    const ok = !result.isError && parsed?.ok !== false;
    const images = (result.content ?? []).filter((item: any) => item.type === 'image').map((item: any) => ({ data: item.data, mimeType: item.mimeType }));
    const record: CallResult<T> = {
      tool,
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
      ok,
      ...(ok ? {} : { errorCode: parsed?.error?.code, hostState: parsed?.error?.hostState, error: parsed?.error }),
      imageCount: images.length,
      payload: (parsed?.result ?? parsed) as T,
      images,
    };
    this.calls.push(strip(record));
    return record;
  }

  async expect<T = any>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.call<T>(tool, args);
    if (!result.ok) throw new Error(`${tool} failed: ${JSON.stringify(result.error)}`);
    return result.payload;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

function strip<T>(record: CallResult<T>): HarnessCall {
  const { tool, startedAt, durationMs, ok, errorCode, hostState, imageCount } = record;
  return { tool, startedAt, durationMs, ok, ...(errorCode ? { errorCode } : {}), ...(hostState ? { hostState } : {}), imageCount };
}

export function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function writeEvidence(directory: string, name: string, value: unknown): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}
