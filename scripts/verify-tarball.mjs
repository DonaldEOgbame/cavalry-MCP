#!/usr/bin/env node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const scratch = await mkdtemp(path.join(os.tmpdir(), 'cavalry-pack-'));
async function smoke(command, args = [], cwd = scratch) {
  const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGTERM'); resolve(); }, 750);
    child.once('error', reject);
    child.once('exit', (code, signal) => { clearTimeout(timeout); code === 0 || signal === 'SIGTERM' ? resolve() : reject(new Error(`${command} exited ${code}`)); });
  });
}
try {
  const prepared = spawnSync('npm', ['run', 'prepack'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (prepared.status !== 0) throw new Error('prepack validation failed');
  const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], { encoding: 'utf8' });
  if (packed.status !== 0) throw new Error(packed.stderr || 'npm pack failed');
  const details = JSON.parse(packed.stdout)[0];
  const tarball = path.join(scratch, details.filename);
  const entries = new Set(details.files.map((entry) => entry.path));
  for (const required of ['dist/index.js', 'dist/index.d.ts', 'cavalry/bridge.js', 'knowledge/generated/knowledge-index.json', 'knowledge/generated/knowledge-index.json.sha256']) {
    if (!entries.has(required)) throw new Error(`Packed tarball is missing ${required}`);
  }

  const local = path.join(scratch, 'local');
  let run = spawnSync('npm', ['init', '-y'], { cwd: scratch, stdio: 'ignore' });
  if (run.status !== 0) throw new Error('npm init failed');
  run = spawnSync('npm', ['install', '--ignore-scripts', tarball], { cwd: scratch, stdio: 'inherit' });
  if (run.status !== 0) throw new Error('local tarball install failed');
  const installed = JSON.parse(await readFile(path.join(scratch, 'node_modules/cavalry-mcp/package.json'), 'utf8'));
  if (installed.version !== details.version) throw new Error('installed package version differs from tarball');
  await smoke(path.join(scratch, 'node_modules/.bin/cavalry-mcp'));

  const prefix = path.join(scratch, 'global-prefix');
  run = spawnSync('npm', ['install', '-g', '--ignore-scripts', '--prefix', prefix, tarball], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('isolated global install failed');
  const bin = process.platform === 'win32' ? path.join(prefix, 'cavalry-mcp.cmd') : path.join(prefix, 'bin/cavalry-mcp');
  await smoke(bin);
  await smoke(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', `--package=${tarball}`, 'cavalry-mcp']);
  process.stdout.write(`Verified ${details.filename}: contents, local dependency, isolated global install, npx, and direct CLI invocation.\n`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
