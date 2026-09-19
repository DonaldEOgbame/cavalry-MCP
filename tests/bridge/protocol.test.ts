import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BridgeClient } from '../../src/bridge/client.js';

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

    client.stopCallbackServer();
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

    deadClient.stopCallbackServer();
  });
});
