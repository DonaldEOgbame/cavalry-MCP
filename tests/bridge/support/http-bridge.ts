import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { BridgeSandbox } from './bridge-sandbox.js';

/**
 * Serves a bridge sandbox over the same HTTP surface as Cavalry's WebServer so
 * the production BridgeClient can talk to the real bridge.js. `blocked`
 * simulates a script host that accepts connections but never runs callbacks.
 */
export interface HttpBridge {
  port: number;
  blocked: boolean;
  close(): Promise<void>;
}

export async function serveBridgeSandbox(sandbox: BridgeSandbox): Promise<HttpBridge> {
  const state = { blocked: false };
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200);
      res.end('Cavalry MCP Bridge');
      return;
    }
    if (req.method === 'GET' && req.url === '/get') {
      res.writeHead(200);
      res.end('');
      return;
    }
    if (req.method === 'POST' && req.url === '/post') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const request = JSON.parse(body);
        // Cavalry's WebServer keeps accepting posts while the script host is
        // stuck; they are processed (or expired) once callbacks run again.
        sandbox.post(request);
        if (state.blocked) {
          res.writeHead(200);
          res.end('');
          return;
        }
        sandbox.pump();
        const response = sandbox.responseFor(request.id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(response ? JSON.stringify(response) : '');
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return {
    port: (server.address() as AddressInfo).port,
    get blocked() { return state.blocked; },
    set blocked(value: boolean) { state.blocked = value; },
    close: () => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
