import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BridgeRequest, BridgeResponse } from './protocol.js';
import { CavalryError } from '../mcp/errors.js';
import { logger } from '../utils/logger.js';
import { identityResolver } from '../utils/ids.js';
import { metadataCache } from '../utils/cache.js';

export interface BridgeClientConfig {
  host?: string;
  port?: number;
  callbackPort?: number;
  timeoutMs?: number;
}

export class BridgeClient {
  private host: string;
  private port: number;
  private callbackPort: number;
  private timeoutMs: number;
  private callbackServer: http.Server | null = null;
  private bridgeInstanceId: string | null = null;
  private pendingRequests = new Map<string, {
    resolve: (res: BridgeResponse<any>) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
    startTime: number;
    op: string;
  }>();

  constructor(config?: BridgeClientConfig) {
    this.host = config?.host || process.env.CAVALRY_BRIDGE_HOST || '127.0.0.1';
    this.port = config?.port || (process.env.CAVALRY_BRIDGE_PORT ? parseInt(process.env.CAVALRY_BRIDGE_PORT, 10) : 8080);
    this.callbackPort = config?.callbackPort || (process.env.CAVALRY_CALLBACK_PORT ? parseInt(process.env.CAVALRY_CALLBACK_PORT, 10) : 8082);
    this.timeoutMs = config?.timeoutMs || (process.env.CAVALRY_BRIDGE_TIMEOUT_MS ? parseInt(process.env.CAVALRY_BRIDGE_TIMEOUT_MS, 10) : 15000);
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
            resolve(this.callbackPort);
          });
        } else {
          reject(err);
        }
      });

      server.listen(this.callbackPort, '127.0.0.1', () => {
        this.callbackServer = server;
        logger.info(`Bridge callback receiver listening on 127.0.0.1:${this.callbackPort}`);
        resolve(this.callbackPort);
      });
    });
  }

  stopCallbackServer() {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  private handleIncomingResponse(response: BridgeResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

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
    overrideTimeoutMs?: number,
  ): Promise<BridgeResponse<TResult>> {
    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timeoutDuration = overrideTimeoutMs || this.timeoutMs;
    const startTime = Date.now();

    // Ensure local callback server is active
    if (!this.callbackServer) {
      try {
        await this.startCallbackServer();
      } catch (e) {
        logger.warn('Could not start callback receiver server; will fall back to /get polling', { data: e });
      }
    }

    const responseFile = path.join(os.tmpdir(), `cavalry_resp_${reqId}.json`);

    const requestPayload: BridgeRequest<TParams> = {
      id: reqId,
      op,
      params,
      callbackUrl: this.callbackServer ? `http://127.0.0.1:${this.callbackPort}/response` : undefined,
      responseFile,
      timestamp: startTime,
    };

    return new Promise<BridgeResponse<TResult>>((resolve, reject) => {
      // Set overall request timeout
      const timer = setTimeout(async () => {
        this.pendingRequests.delete(reqId);
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
        reject(timeoutError);
      }, timeoutDuration);

      this.pendingRequests.set(reqId, {
        resolve: (res) => {
          try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
          logger.debug(`Operation '${op}' completed`, { requestId: reqId, durationMs: Date.now() - startTime, success: true });
          resolve(res);
        },
        reject: (err) => {
          try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
          logger.error(`Operation '${op}' failed`, err, { requestId: reqId, durationMs: Date.now() - startTime, success: false });
          reject(err);
        },
        timer,
        startTime,
        op,
      });

      // Send the POST request to Cavalry WebServer
      fetch(`http://${this.host}:${this.port}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
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
        clearTimeout(timer);
        this.pendingRequests.delete(reqId);
        try { if (fs.existsSync(responseFile)) fs.unlinkSync(responseFile); } catch {}
        const error = CavalryError.fromUnknown(postErr, op);
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
