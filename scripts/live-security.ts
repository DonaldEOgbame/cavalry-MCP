import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { BRIDGE_PROTOCOL_VERSION } from '../src/bridge/protocol.js';

const ipcRoot = path.join(os.tmpdir(), 'cavalry-mcp');
fs.mkdirSync(ipcRoot, { recursive: true, mode: 0o700 });
const sessionId = crypto.randomUUID();
const token = crypto.randomBytes(32).toString('hex');
const responseDirectory = path.join(ipcRoot, sessionId);
const sessionFile = path.join(ipcRoot, `session-${sessionId}.json`);
fs.mkdirSync(responseDirectory, { recursive: true, mode: 0o700 });

const callbacks: any[] = [];
const callbackServer = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    if (body) callbacks.push(JSON.parse(body));
    response.writeHead(200).end();
  });
});
await new Promise<void>((resolve) => callbackServer.listen(0, '127.0.0.1', resolve));
const callbackPort = (callbackServer.address() as any).port;
fs.writeFileSync(sessionFile, JSON.stringify({ sessionId, token, callbackHost: '127.0.0.1', callbackPort, responseDirectory, expiresAt: Date.now() + 60_000 }), { mode: 0o600 });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function post(payload: any) {
  await fetch('http://127.0.0.1:8080/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
}
async function waitForCallback(start: number) {
  for (let index = 0; index < 40 && callbacks.length === start; index += 1) await wait(25);
  return callbacks.at(-1);
}
function request(id = `req_${crypto.randomUUID()}`) {
  const responseFile = path.join(responseDirectory, `${id}.json`);
  fs.writeFileSync(responseFile, '', { flag: 'wx', mode: 0o600 });
  return { protocolVersion: BRIDGE_PROTOCOL_VERSION, clientCapabilities: [], id, sessionId, token, op: 'cavalry_ping', params: {}, callbackUrl: `http://127.0.0.1:${callbackPort}/response`, responseFile, timestamp: Date.now() };
}

try {
  const valid = request();
  let start = callbacks.length;
  await post(valid);
  assert.equal((await waitForCallback(start)).ok, true);

  start = callbacks.length;
  await post(valid);
  const replay = await waitForCallback(start);
  assert.equal(replay.ok, false);
  assert.equal(replay.error.code, 'REPLAYED_REQUEST');

  for (const mutation of [
    (value: any) => { delete value.token; },
    (value: any) => { value.token = '0'.repeat(64); },
    (value: any) => { value.timestamp = Date.now() - 10 * 60 * 1000; },
  ]) {
    const probe = request();
    mutation(probe);
    start = callbacks.length;
    await post(probe);
    await wait(150);
    assert.equal(callbacks.length, start);
  }

  const unusualCallback = request();
  unusualCallback.callbackUrl = `http://127.0.0.1%2eattacker.invalid:${callbackPort}/response`;
  start = callbacks.length;
  await post(unusualCallback);
  await wait(150);
  assert.equal(callbacks.length, start);

  const traversalTarget = path.join(ipcRoot, `escape-${crypto.randomUUID()}.json`);
  const traversal = request();
  traversal.responseFile = traversalTarget;
  delete traversal.callbackUrl;
  await post(traversal);
  await wait(150);
  assert.equal(fs.existsSync(traversalTarget), false);

  const symlinkTarget = path.join(ipcRoot, `symlink-target-${crypto.randomUUID()}.json`);
  fs.writeFileSync(symlinkTarget, 'unchanged');
  const symlink = request();
  fs.unlinkSync(symlink.responseFile);
  fs.symlinkSync(symlinkTarget, symlink.responseFile);
  delete symlink.callbackUrl;
  await post(symlink);
  await wait(150);
  assert.equal(fs.readFileSync(symlinkTarget, 'utf8'), 'unchanged');
  fs.unlinkSync(symlinkTarget);

  process.stdout.write('PASS missing/invalid/stale/replayed auth, encoded callbacks, traversal, and symlink response paths.\n');
} finally {
  await new Promise<void>((resolve) => callbackServer.close(() => resolve()));
  fs.rmSync(responseDirectory, { recursive: true, force: true });
  try { fs.unlinkSync(sessionFile); } catch {}
}
