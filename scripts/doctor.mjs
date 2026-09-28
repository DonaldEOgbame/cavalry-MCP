#!/usr/bin/env node
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (name, ok, details, required = true) => checks.push({ name, ok, details, required });

const nodeMajor = Number(process.versions.node.split('.')[0]);
add('Node.js', nodeMajor >= 20, process.versions.node);
for (const relative of ['dist/index.js', 'cavalry/bridge.js', 'knowledge/generated/knowledge-index.json']) {
  try { await access(path.join(root, relative)); add(relative, true, 'readable'); } catch { add(relative, false, 'missing'); }
}

try {
  const seedPath = path.join(root, 'knowledge/generated/knowledge-index.json');
  const expected = (await readFile(`${seedPath}.sha256`, 'utf8')).trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(await readFile(seedPath)).digest('hex');
  add('Knowledge seed integrity', actual === expected, actual === expected ? `${actual.slice(0, 12)}… verified` : 'checksum mismatch');
} catch (error) { add('Knowledge seed integrity', false, error.message); }

const scratch = await mkdtemp(path.join(os.tmpdir(), 'cavalry-doctor-'));
try { await writeFile(path.join(scratch, 'probe'), 'ok'); add('Temporary files', true, scratch); }
catch (error) { add('Temporary files', false, error.message); }
finally { await rm(scratch, { recursive: true, force: true }); }

for (const binary of ['ffmpeg', 'ffprobe']) {
  try { const { stdout } = await execFileAsync(binary, ['-version']); add(binary, true, stdout.split('\n')[0], false); }
  catch { add(binary, false, 'not found; media validation is limited', false); }
}

if (process.platform === 'darwin') {
  try { await access('/Applications/Cavalry.app'); add('Cavalry application', true, '/Applications/Cavalry.app', false); }
  catch { add('Cavalry application', false, 'not installed in /Applications', false); }
}

let live = false;
try { const response = await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(1000) }); live = response.status > 0; } catch {}
add('Cavalry bridge', live, live ? 'listening on 127.0.0.1:8080' : 'offline; run npm run bridge:launch', process.argv.includes('--require-live'));

if (live) {
  try {
    const { BridgeClient } = await import('../dist/bridge/client.js');
    const client = new BridgeClient({ timeoutMs: 3000 });
    const health = (await client.send('cavalry_health')).result;
    const fonts = (await client.send('font_list')).result;
    const caps = (await client.send('cavalry_capabilities')).result;
    add('Bridge auth/protocol', true, `protocol v${health.protocolVersion}; Cavalry ${health.cavalryVersion}`);
    add('Fonts', Array.isArray(fonts.fonts) && fonts.fonts.length > 0, `${fonts.fonts?.length ?? 0} families`, false);
    add('Render capability', caps.supportsRenderQueue === true, caps.supportsRenderQueue ? 'available' : 'unavailable', false);
    await client.stopCallbackServer();
  } catch (error) { add('Bridge auth/protocol', false, error.message); }
}

add('Security tier', true, process.env.CAVALRY_SECURITY_TIER ?? 'SAFE (default)', false);
add('Raw scripts', true, process.env.CAVALRY_ALLOW_RAW_SCRIPT === 'true' ? 'enabled explicitly' : 'disabled', false);
add('Allowed roots', true, process.env.CAVALRY_ALLOWED_ROOTS ?? 'workspace + temporary directory', false);

for (const check of checks) process.stdout.write(`${check.ok ? 'PASS' : check.required ? 'FAIL' : 'WARN'}  ${check.name}: ${check.details}\n`);
if (checks.some((check) => check.required && !check.ok)) process.exitCode = 1;
