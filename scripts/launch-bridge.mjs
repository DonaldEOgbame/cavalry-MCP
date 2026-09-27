#!/usr/bin/env node

import { copyFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  throw new Error('Automatic bridge activation currently requires macOS. On Windows, install cavalry/bridge.js and choose Scripts > CavalryBridge.');
}

const scriptsDirectory = path.join(os.homedir(), 'Library', 'Application Support', 'Cavalry', 'Scripts');
await mkdir(scriptsDirectory, { recursive: true });
await copyFile(path.join(packageRoot, 'cavalry', 'bridge.js'), path.join(scriptsDirectory, 'CavalryBridge.js'));
await execFileAsync('/usr/bin/open', ['-a', 'Cavalry']);
await new Promise((resolve) => setTimeout(resolve, 5_000));
await execFileAsync('/usr/bin/osascript', [
  '-e', 'tell application "Cavalry" to activate',
  '-e', 'delay 1',
  '-e', 'tell application "System Events" to tell process "Cavalry" to click menu item "CavalryBridge" of menu 1 of menu bar item "Scripts" of menu bar 1',
]);
process.stdout.write('Installed and activated the Cavalry MCP bridge.\n');

