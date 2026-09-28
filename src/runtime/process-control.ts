import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cavalryProcessRunning } from './host-probe.js';

const execFileAsync = promisify(execFile);

export interface TerminateResult {
  wasRunning: boolean | null;
  exited: boolean;
  forced: boolean;
  durationMs: number;
}

/** Host process control used by clean-host recovery. */
export interface ProcessControl {
  supported: boolean;
  unsupportedReason?: string;
  isRunning(): Promise<boolean | null>;
  terminate(graceMs?: number): Promise<TerminateResult>;
  launch(): Promise<void>;
  /** Starts the bridge script through the Scripts menu when Cavalry did not restore it. */
  activateBridge(): Promise<boolean>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForExit(isRunning: () => Promise<boolean | null>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRunning() === false) return true;
    await sleep(250);
  }
  return await isRunning() === false;
}

export function macProcessControl(appName = process.env.CAVALRY_PROCESS_NAME || 'Cavalry'): ProcessControl {
  const isRunning = cavalryProcessRunning;
  return {
    supported: true,
    isRunning,
    async terminate(graceMs = 10_000) {
      const started = Date.now();
      const wasRunning = await isRunning();
      if (wasRunning === false) return { wasRunning, exited: true, forced: false, durationMs: 0 };
      try { await execFileAsync('/usr/bin/pkill', ['-TERM', '-x', appName]); } catch {}
      // A modal dialog ("save changes?", a script error) can block a polite
      // quit indefinitely; escalate rather than wait on it.
      if (await waitForExit(isRunning, graceMs)) return { wasRunning, exited: true, forced: false, durationMs: Date.now() - started };
      try { await execFileAsync('/usr/bin/pkill', ['-KILL', '-x', appName]); } catch {}
      const exited = await waitForExit(isRunning, 5_000);
      return { wasRunning, exited, forced: true, durationMs: Date.now() - started };
    },
    async launch() {
      await execFileAsync('/usr/bin/open', ['-a', process.env.CAVALRY_APP_PATH || appName]);
    },
    async activateBridge() {
      try {
        await execFileAsync('/usr/bin/osascript', [
          '-e', `tell application "${appName}" to activate`,
          '-e', 'delay 1',
          '-e', `tell application "System Events" to tell process "${appName}" to click menu item "CavalryBridge" of menu 1 of menu bar item "Scripts" of menu bar 1`,
        ], { timeout: 15_000 });
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function unsupportedProcessControl(reason: string): ProcessControl {
  return {
    supported: false,
    unsupportedReason: reason,
    isRunning: cavalryProcessRunning,
    async terminate() { return { wasRunning: null, exited: false, forced: false, durationMs: 0 }; },
    async launch() { throw new Error(reason); },
    async activateBridge() { return false; },
  };
}

export function defaultProcessControl(): ProcessControl {
  if (process.platform !== 'darwin') return unsupportedProcessControl(`Automatic Cavalry restart is implemented for macOS only (platform: ${process.platform}).`);
  if (process.env.CAVALRY_WATCHDOG_AUTO_RESTART !== 'true') return unsupportedProcessControl('Automatic Cavalry restart is disabled; set CAVALRY_WATCHDOG_AUTO_RESTART=true to allow clean-host recovery.');
  return macProcessControl();
}

/** Forcefully kills Cavalry (fault injection and last-resort recovery only). */
export async function killCavalry(): Promise<void> {
  const name = process.env.CAVALRY_PROCESS_NAME || 'Cavalry';
  if (process.platform === 'darwin') await execFileAsync('/usr/bin/pkill', ['-KILL', '-x', name]).catch(() => undefined);
  else if (process.platform === 'win32') await execFileAsync('taskkill', ['/F', '/IM', `${name}.exe`]).catch(() => undefined);
}
