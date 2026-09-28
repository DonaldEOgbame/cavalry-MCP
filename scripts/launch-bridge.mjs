#!/usr/bin/env node

import { copyFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function bridgeIsListening() {
  try {
    const response = await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(500) });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function waitForBridge(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await bridgeIsListening()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

if (process.platform !== 'darwin') {
  throw new Error('Automatic bridge activation currently requires macOS. On Windows, install cavalry/bridge.js and choose Scripts > CavalryBridge.');
}

const scriptsDirectory = path.join(os.homedir(), 'Library', 'Application Support', 'Cavalry', 'Scripts');
await mkdir(scriptsDirectory, { recursive: true });
await copyFile(path.join(packageRoot, 'cavalry', 'bridge.js'), path.join(scriptsDirectory, 'CavalryBridge.js'));
await execFileAsync('/usr/bin/open', ['-a', 'Cavalry']);
if (!await waitForBridge(10_000)) {
  try {
    await execFileAsync('/usr/bin/osascript', [
      '-e', 'tell application "Cavalry" to activate',
      '-e', 'delay 1',
      '-e', 'tell application "System Events" to tell process "Cavalry" to click menu item "CavalryBridge" of menu 1 of menu bar item "Scripts" of menu bar 1',
    ]);
  } catch (error) {
    throw new Error('Cavalry opened but the bridge could not be activated automatically. Enable Accessibility access for your terminal/Codex host, then retry.', { cause: error });
  }
  if (!await waitForBridge(10_000)) throw new Error('CavalryBridge was activated but did not begin listening on 127.0.0.1:8080.');
}
process.stdout.write('Installed and activated the Cavalry MCP bridge.\n');
