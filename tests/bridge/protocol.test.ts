import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BridgeClient } from '../../src/bridge/client.js';
import { BRIDGE_PROTOCOL_VERSION } from '../../src/bridge/protocol.js';

describe('BridgeClient Protocol & Communication', () => {
  let mockCavalryServer: http.Server;
  const mockPort = 8999;
  let receivedRequests: any[] = [];

  before(async () => {
    mockCavalryServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/post') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          const parsed = JSON.parse(body);
          receivedRequests.push(parsed);

          const responseData = {
            id: parsed.id,
            token: parsed.token,
            protocolVersion: BRIDGE_PROTOCOL_VERSION,
            bridgeCapabilities: ['protocol-negotiation'],
            ok: true,
            operation: parsed.op,
            result: { echoOp: parsed.op, params: parsed.params },
            durationMs: 5,
          };

          // Simulate Cavalry WebClient callback to the MCP client's callback server
          if (parsed.callbackUrl) {
            try {
              await fetch(parsed.callbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responseData),
              });
            } catch {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
        });
      } else if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200);
        res.end('Mock Cavalry Bridge');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>(resolve => mockCavalryServer.listen(mockPort, '127.0.0.1', () => resolve()));
  });

  after(() => {
    mockCavalryServer.close();
  });

  it('connects to mock bridge, sends request, and correlates response', async () => {
    const client = new BridgeClient({
      host: '127.0.0.1',
      port: mockPort,
      callbackPort: 8998,
      timeoutMs: 3000,
    });

    const isAlive = await client.ping();
    assert.equal(isAlive, true);

    const response = await client.send('layer_create', { layerType: 'textShape', name: 'Title' });
    assert.equal(response.ok, true);
    assert.equal(response.operation, 'layer_create');
    assert.deepEqual(response.result, {
      echoOp: 'layer_create',
      params: { layerType: 'textShape', name: 'Title' },
    });
    const request = receivedRequests.at(-1);
    assert.match(request.id, /^req_[0-9a-f-]{36}$/i);
    assert.match(request.sessionId, /^[0-9a-f-]{36}$/i);
    assert.match(request.token, /^[0-9a-f]{64}$/i);
    assert.match(request.callbackUrl, /^http:\/\/127\.0\.0\.1:\d+\/response$/);
    assert.ok(request.responseFile.includes(`/cavalry-mcp/${request.sessionId}/`));

    await client.stopCallbackServer();
  });

  it('rejects with BRIDGE_TIMEOUT when bridge fails to respond in time', async () => {
    // Port with nothing listening
    const deadClient = new BridgeClient({
      host: '127.0.0.1',
      port: 8997,
      timeoutMs: 300,
    });

    await assert.rejects(
      async () => deadClient.send('test_op', {}),
      (err: any) => err.code === 'BRIDGE_OFFLINE' || err.code === 'BRIDGE_TIMEOUT',
    );

    await deadClient.stopCallbackServer();
  });

  it('isolates concurrent clients with unique sessions, tokens, callbacks, and response directories', async () => {
    const first = new BridgeClient({ host: '127.0.0.1', port: mockPort, callbackPort: 8998 });
    const second = new BridgeClient({ host: '127.0.0.1', port: mockPort, callbackPort: 8996 });
    await Promise.all([first.send('first'), second.send('second')]);
    const [a, b] = receivedRequests.slice(-2);
    assert.notEqual(a.sessionId, b.sessionId);
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.callbackUrl, b.callbackUrl);
    assert.notEqual(a.responseFile.split('/').slice(0, -1).join('/'), b.responseFile.split('/').slice(0, -1).join('/'));
    await Promise.all([first.stopCallbackServer(), second.stopCallbackServer()]);
  });

  it('rejects forged callback tokens', async () => {
    const client = new BridgeClient({ host: '127.0.0.1', port: mockPort, callbackPort: 8998 });
    await client.send('auth_probe');
    const request = receivedRequests.at(-1);
    const response = await fetch(request.callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: request.id, token: '0'.repeat(64), protocolVersion: BRIDGE_PROTOCOL_VERSION, ok: true, operation: 'auth_probe', durationMs: 0 }),
    });
    assert.equal(response.status, 403);
    await client.stopCallbackServer();
  });

  it('cancels a request and cleans the session without waiting for the host timeout', async () => {
    const hanging = http.createServer((_req, _res) => {});
    await new Promise<void>((resolve) => hanging.listen(8995, '127.0.0.1', resolve));
    const client = new BridgeClient({ host: '127.0.0.1', port: 8995, callbackPort: 8994, timeoutMs: 30_000 });
    const controller = new AbortController();
    const request = client.send('slow_op', {}, { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, (error: any) => error.code === 'OPERATION_CANCELLED');
    await client.stopCallbackServer();
    hanging.closeAllConnections();
    await new Promise<void>((resolve) => hanging.close(() => resolve()));
  });
});
