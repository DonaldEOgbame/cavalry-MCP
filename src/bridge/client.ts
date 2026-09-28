import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { BRIDGE_PROTOCOL_VERSION, BridgeRequest, BridgeResponse } from './protocol.js';
import { CavalryError } from '../mcp/errors.js';
import { logger } from '../utils/logger.js';
import { identityResolver } from '../utils/ids.js';
import { metadataCache } from '../utils/cache.js';
import { incidentJournal } from '../runtime/incidents.js';

export interface BridgeClientConfig {
  host?: string;
  port?: number;
  callbackPort?: number;
  timeoutMs?: number;
}

export interface BridgeSendOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface InFlightRequest {
  requestId: string;
  op: string;
  startedAt: number;
  ageMs: number;
  timeoutMs: number;
}

export interface BridgeTransportStats {
  lastSuccessAt: number | null;
  lastFailure: { code: string; op: string; at: number } | null;
  consecutiveTimeouts: number;
  bridgeInstanceId: string | null;
  incidentAck: number;
}

export class BridgeClient {
  private host: string;
  private port: number;
  private callbackPort: number;
  private timeoutMs: number;
  private callbackServer: http.Server | null = null;
  private bridgeInstanceId: string | null = null;
  private incidentAckInstance: string | null = null;
  private incidentAck = 0;
  private lastSuccessAt: number | null = null;
  private lastFailure: BridgeTransportStats['lastFailure'] = null;
  private consecutiveTimeouts = 0;
  private readonly sessionId = crypto.randomUUID();
  private readonly sessionToken = crypto.randomBytes(32).toString('hex');
  private readonly ipcRoot = path.join(os.tmpdir(), 'cavalry-mcp');
  private readonly responseDirectory = path.join(os.tmpdir(), 'cavalry-mcp', this.sessionId);
  private readonly sessionFile = path.join(os.tmpdir(), 'cavalry-mcp', `session-${this.sessionId}.json`);
  private pendingRequests = new Map<string, {
    resolve: (res: BridgeResponse<any>) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
    controller: AbortController;
    startTime: number;
    timeoutMs: number;
    op: string;
  }>();

  constructor(config?: BridgeClientConfig) {
    this.host = config?.host || process.env.CAVALRY_BRIDGE_HOST || '127.0.0.1';
    this.port = config?.port || (process.env.CAVALRY_BRIDGE_PORT ? parseInt(process.env.CAVALRY_BRIDGE_PORT, 10) : 8080);
    this.callbackPort = config?.callbackPort || (process.env.CAVALRY_CALLBACK_PORT ? parseInt(process.env.CAVALRY_CALLBACK_PORT, 10) : 8082);
    this.timeoutMs = config?.timeoutMs || (process.env.CAVALRY_BRIDGE_TIMEOUT_MS ? parseInt(process.env.CAVALRY_BRIDGE_TIMEOUT_MS, 10) : 15000);
  }

  get sessionIdentifier(): string { return this.sessionId; }

  /** Requests dispatched to Cavalry that have not yet resolved. */
  inFlight(now = Date.now()): InFlightRequest[] {
    return [...this.pendingRequests.entries()].map(([requestId, pending]) => ({
      requestId, op: pending.op, startedAt: pending.startTime, ageMs: now - pending.startTime, timeoutMs: pending.timeoutMs,
    }));
  }

  transportStats(): BridgeTransportStats {
    return {
      lastSuccessAt: this.lastSuccessAt,
      lastFailure: this.lastFailure,
      consecutiveTimeouts: this.consecutiveTimeouts,
      bridgeInstanceId: this.bridgeInstanceId,
      incidentAck: this.incidentAck,
    };
  }

  private absorbIncidents(response: BridgeResponse): void {
    const instance = response.bridgeInstanceId ?? null;
    if (instance && instance !== this.incidentAckInstance) {
      // A restarted bridge numbers incidents from zero again.
      this.incidentAckInstance = instance;
      this.incidentAck = 0;
    }
    if (response.incidents?.length) {
      incidentJournal.ingest(response.incidents, instance ?? undefined);
      this.incidentAck = Math.max(this.incidentAck, ...response.incidents.map((incident) => incident.updatedSeq));
    } else if (typeof response.incidentSeq === 'number' && instance === this.incidentAckInstance) {
      this.incidentAck = Math.max(this.incidentAck, response.incidentSeq);
    }
  }

  private noteFailure(code: string, op: string): void {
    this.lastFailure = { code, op, at: Date.now() };
    if (code === 'BRIDGE_TIMEOUT') this.consecutiveTimeouts += 1;
  }

  private writeSessionFile(): void {
    fs.mkdirSync(this.ipcRoot, { recursive: true, mode: 0o700 });
    fs.mkdirSync(this.responseDirectory, { recursive: true, mode: 0o700 });
    const temporary = `${this.sessionFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({
      sessionId: this.sessionId,
      token: this.sessionToken,
      callbackHost: '127.0.0.1',
      callbackPort: this.callbackServer ? this.callbackPort : null,
      responseDirectory: this.responseDirectory,
      allowRawScript: process.env.CAVALRY_ALLOW_RAW_SCRIPT === 'true' || process.env.CAVALRY_SECURITY_TIER?.toUpperCase() === 'RAW',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, this.sessionFile);
  }

  async startCallbackServer(): Promise<number> {
    if (this.callbackServer) return this.callbackPort;

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/response') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as BridgeResponse;
              if (payload.token !== this.sessionToken) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid bridge session token' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ received: true }));
              this.handleIncomingResponse(payload);
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.on('error', (err: any) => {
        // If preferred port is taken, fallback to ephemeral port (0)
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${this.callbackPort} in use, trying random ephemeral port`);
          server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as any;
            this.callbackPort = addr.port;
            this.callbackServer = server;
            this.writeSessionFile();
            resolve(this.callbackPort);
          });
        } else {
          reject(err);
        }
      });

      server.listen(this.callbackPort, '127.0.0.1', () => {
        this.callbackServer = server;
        this.writeSessionFile();
        logger.info(`Bridge callback receiver listening on 127.0.0.1:${this.callbackPort}`);
        resolve(this.callbackPort);
      });
    });
  }

  async stopCallbackServer(): Promise<void> {
    const shutdownError = new CavalryError({ code: 'OPERATION_CANCELLED', message: 'Bridge client session closed.', suggestion: 'Retry the operation in a new MCP session.' });
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.controller.abort();
      pending.reject(shutdownError);
    }
    this.pendingRequests.clear();
    const server = this.callbackServer;
    this.callbackServer = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(this.sessionFile); } catch {}
    try { fs.rmSync(this.responseDirectory, { recursive: true, force: true }); } catch {}
  }

  private handleIncomingResponse(response: BridgeResponse) {
    if (response.token === this.sessionToken) {
      // Late responses (after a client timeout) still carry incident updates.
      try { this.absorbIncidents(response); } catch (error) { logger.warn('Could not journal bridge incidents', { data: error }); }
    }
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.token === this.sessionToken) {
      this.consecutiveTimeouts = 0;
      this.lastSuccessAt = Date.now();
    }

    if (response.token !== this.sessionToken) {
      pending.reject(new CavalryError({
        code: 'BRIDGE_AUTH_FAILED',
        message: 'Bridge response did not authenticate to this MCP session.',
        operation: pending.op,
        suggestion: 'Restart the MCP server and reinstall the matching Cavalry bridge if this persists.',
      }));
      return;
    }

    if (response.protocolVersion !== BRIDGE_PROTOCOL_VERSION) {
      pending.reject(new CavalryError({
        code: 'BRIDGE_PROTOCOL_MISMATCH',
        message: `Bridge protocol mismatch: client requires v${BRIDGE_PROTOCOL_VERSION}, bridge returned ${response.protocolVersion ?? 'no version'}.`,
        operation: pending.op,
        suggestion: 'Reinstall cavalry/bridge.js from the same cavalry-mcp package version and restart Cavalry.',
      }));
      return;
    }

    const result = response.result as { bridgeInstanceId?: string } | undefined;
    if (result?.bridgeInstanceId && result.bridgeInstanceId !== this.bridgeInstanceId) {
      if (this.bridgeInstanceId !== null) {
        metadataCache.clear();
        identityResolver.invalidate();
      }
      this.bridgeInstanceId = result.bridgeInstanceId;
    }

    // If affected layers were reported, update the identity cache
    if (response.affected && Array.isArray(response.affected)) {
      for (const item of response.affected) {
        identityResolver.register(item);
      }
    }

    if (!response.ok && response.error) {
      this.noteFailure(response.error.code, pending.op);
      pending.reject(new CavalryError(response.error));
    } else {
      pending.resolve(response);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`http://${this.host}:${this.port}/`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok || res.status === 404; // Any HTTP response confirms server is listening
    } catch {
      return false;
    }
  }

  async send<TResult = unknown, TParams = any>(
    op: string,
    params: TParams = {} as TParams,
    overrideTimeoutOrOptions?: number | BridgeSendOptions,
  ): Promise<BridgeResponse<TResult>> {
    const reqId = `req_${crypto.randomUUID()}`;
    const options = typeof overrideTimeoutOrOptions === 'number' ? { timeoutMs: overrideTimeoutOrOptions } : (overrideTimeoutOrOptions ?? {});
    const timeoutDuration = options.timeoutMs || this.timeoutMs;
    const startTime = Date.now();
    if (options.signal?.aborted) throw new CavalryError({ code: 'OPERATION_CANCELLED', message: `Bridge operation '${op}' was cancelled before dispatch.`, operation: op });

    // Ensure local callback server is active
    if (!this.callbackServer) {
      try {
        await this.startCallbackServer();
      } catch (e) {
        logger.warn('Could not start callback receiver server; will fall back to /get polling', { data: e });
      }
    }

    if (options.signal?.aborted) throw new CavalryError({ code: 'OPERATION_CANCELLED', message: `Bridge operation '${op}' was cancelled before dispatch.`, operation: op });

    this.writeSessionFile();

    const responseFile = path.join(this.responseDirectory, `${reqId}.json`);
    fs.writeFileSync(responseFile, '', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    incidentJournal.noteRequest(reqId, op);

    const requestPayload: BridgeRequest<TParams> = {
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      clientCapabilities: ['authenticated-sessions', 'callback-v1', 'response-file-v1', 'request-cancellation', 'transactional-batch'],
      id: reqId,
      sessionId: this.sessionId,
      token: this.sessionToken,
      op,
      params,
      callbackUrl: this.callbackServer ? `http://127.0.0.1:${this.callbackPort}/response` : undefined,
      responseFile,
      timestamp: startTime,
      deadlineAt: startTime + timeoutDuration,
      ackIncidentSeq: this.incidentAck,
    };

    return new Promise<BridgeResponse<TResult>>((resolve, reject) => {
      const controller = new AbortController();
      const abort = () => {
        const pending = this.pendingRequests.get(reqId);
        if (!pending) return;
        clearTimeout(pending.timer);
        pending.controller.abort();
        this.pendingRequests.delete(reqId);
        try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
        reject(new CavalryError({ code: 'OPERATION_CANCELLED', message: `Bridge operation '${op}' was cancelled.`, operation: op, suggestion: 'The host may finish an already-dispatched native call; refresh scene state before retrying.' }));
      };
      options.signal?.addEventListener('abort', abort, { once: true });
      // Set overall request timeout
      const timer = setTimeout(async () => {
        this.pendingRequests.delete(reqId);
        controller.abort();
        metadataCache.clear();
        identityResolver.invalidate();
        // Clean up responseFile if left behind
        try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}

        const timeoutError = new CavalryError({
          code: 'BRIDGE_TIMEOUT',
          message: `Bridge operation '${op}' timed out after ${timeoutDuration}ms.`,
          operation: op,
          suggestion: 'Check if Cavalry is unresponsive, waiting for user confirmation, or processing a heavy task.',
        });
        logger.error(`Request ${reqId} timed out`, timeoutError, { operation: op, durationMs: Date.now() - startTime });
        this.noteFailure('BRIDGE_TIMEOUT', op);
        reject(timeoutError);
      }, timeoutDuration);

      this.pendingRequests.set(reqId, {
        resolve: (res) => {
          options.signal?.removeEventListener('abort', abort);
          try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
          logger.debug(`Operation '${op}' completed`, { requestId: reqId, durationMs: Date.now() - startTime, success: true });
          resolve(res);
        },
        reject: (err) => {
          options.signal?.removeEventListener('abort', abort);
          try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
          logger.error(`Operation '${op}' failed`, err, { requestId: reqId, durationMs: Date.now() - startTime, success: false });
          reject(err);
        },
        timer,
        controller,
        startTime,
        timeoutMs: timeoutDuration,
        op,
      });

      // Send the POST request to Cavalry WebServer
      fetch(`http://${this.host}:${this.port}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      }).then(async (postRes) => {
        if (!postRes.ok) {
          throw new Error(`Cavalry WebServer returned HTTP status ${postRes.status}`);
        }

        // Check if the response was immediately returned in the POST body
        const postText = await postRes.text().catch(() => '');
        if (postText && postText.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(postText) as BridgeResponse<TResult>;
            if (parsed.id === reqId) {
              this.handleIncomingResponse(parsed);
              return;
            }
          } catch {}
        }

        // Start fallback poller for GET /get and file check
        this.startFallbackPoller(reqId, responseFile, startTime);
      }).catch((postErr) => {
        if (!this.pendingRequests.has(reqId)) return;
        clearTimeout(timer);
        this.pendingRequests.delete(reqId);
        try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
        const error = CavalryError.fromUnknown(postErr, op);
        this.noteFailure(error.code, op);
        metadataCache.clear();
        identityResolver.invalidate();
        logger.error(`Failed to send request ${reqId} to Cavalry`, error, { operation: op });
        reject(error);
      });
    });
  }

  private async startFallbackPoller(reqId: string, responseFile: string, startTime: number) {
    const pollIntervalMs = 25;
    const poll = async () => {
      const pending = this.pendingRequests.get(reqId);
      if (!pending) return; // Request already finished or cancelled

      // 1. Check if temporary response file was written
      try {
        if (fs.existsSync(responseFile)) {
          const content = fs.readFileSync(responseFile, 'utf8');
          if (content && content.trim().startsWith('{')) {
            const parsed = JSON.parse(content) as BridgeResponse;
            if (parsed.id === reqId) {
              this.handleIncomingResponse(parsed);
              return;
            }
          }
        }
      } catch {}

      // 2. Poll GET /get on Cavalry's WebServer
      try {
        const getRes = await fetch(`http://${this.host}:${this.port}/get`);
        if (getRes.ok) {
          const text = await getRes.text();
          if (text && text.trim().startsWith('{')) {
            const parsed = JSON.parse(text) as BridgeResponse;
            if (parsed.id === reqId) {
              this.handleIncomingResponse(parsed);
              return;
            }
          }
        }
      } catch {}

      // Continue polling if still pending
      if (this.pendingRequests.has(reqId)) {
        setTimeout(poll, pollIntervalMs);
      }
    };

    setTimeout(poll, pollIntervalMs);
  }
}

export const bridgeClient = new BridgeClient();
