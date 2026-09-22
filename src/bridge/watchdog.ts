import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bridgeClient } from './client.js';

const execFileAsync = promisify(execFile);

export type OperationRisk = 'SAFE' | 'CAUTION' | 'HOST_UNSTABLE';

const HOST_UNSTABLE = new Set([
  'camera_create_guide', 'camera_set_type', 'camera_set_guides',
  'camera_add_guide', 'camera_remove_guide',
  'path_keyframe_set', 'path_keyframe_resync', 'path_morph',
  'timeline_play',
]);

const CAUTION = new Set([
  'render_start', 'render_start_all', 'render_background_start',
  'scene_open', 'scene_import', 'scene_restore_checkpoint',
]);

export function operationRisk(operation: string): OperationRisk {
  if (HOST_UNSTABLE.has(operation)) return 'HOST_UNSTABLE';
  if (CAUTION.has(operation)) return 'CAUTION';
  return 'SAFE';
}

export function safeAlternativeFor(operation: string): string[] {
  if (operation.startsWith('path_')) return ['path_morph_safe', 'path_animation_safe'];
  if (operation === 'timeline_play') return ['timeline_preview_playback', 'preview_video', 'preview_frames'];
  if (operation.startsWith('camera_')) return ['camera_sequence_create', 'camera_cut', 'camera_transition', 'camera_look_at'];
  return [];
}

async function waitForBridge(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await bridgeClient.ping()) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

export async function recoverCavalryBridge(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  if (process.env.CAVALRY_WATCHDOG_AUTO_RESTART !== 'true') return false;
  try {
    await execFileAsync('/usr/bin/pkill', ['-TERM', '-x', 'Cavalry']);
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2_000));
  await execFileAsync('/usr/bin/open', ['-a', 'Cavalry']);
  await new Promise(resolve => setTimeout(resolve, 5_000));
  try {
    await execFileAsync('/usr/bin/osascript', [
      '-e', 'tell application "Cavalry" to activate',
      '-e', 'delay 1',
      '-e', 'tell application "System Events" to tell process "Cavalry" to click menu item "CavalryBridge" of menu 1 of menu bar item "Scripts" of menu bar 1',
    ]);
  } catch {
    return false;
  }
  return waitForBridge(30_000);
}

export interface SupervisedOperationOptions {
  allowHostUnstable?: boolean;
  timeoutMs?: number;
  restoreOnFailure?: boolean;
}

export async function executeSupervised(
  operation: string,
  params: Record<string, unknown>,
  options: SupervisedOperationOptions = {},
): Promise<Record<string, unknown>> {
  const risk = operationRisk(operation);
  if (risk === 'HOST_UNSTABLE' && options.allowHostUnstable !== true) {
    return {
      executed: false,
      operation,
      risk,
      status: 'KNOWN_HOST_LIMITATION',
      safeAlternatives: safeAlternativeFor(operation),
      message: 'Native invocation is blocked because it can terminate or wedge Cavalry 2.7.2.',
    };
  }

  const healthBefore = await bridgeClient.send<any>('cavalry_health', {}, 3_000);
  const checkpoint = risk === 'SAFE'
    ? undefined
    : (await bridgeClient.send<any>('scene_checkpoint', {}, 10_000)).result;
  const started = Date.now();

  try {
    const response = await bridgeClient.send<any>(operation, params, options.timeoutMs ?? 15_000);
    const healthy = await bridgeClient.ping();
    return {
      executed: true,
      operation,
      risk,
      status: healthy ? 'PASS' : 'HOST_LOST_AFTER_RESPONSE',
      durationMs: Date.now() - started,
      checkpointId: checkpoint?.checkpointId,
      healthBefore: healthBefore.result,
      bridgeHealthyAfter: healthy,
      result: response.result,
    };
  } catch (error) {
    let recovered = await bridgeClient.ping();
    let restarted = false;
    if (!recovered) {
      restarted = await recoverCavalryBridge();
      recovered = restarted;
    }
    let checkpointRestored = false;
    if (recovered && checkpoint?.data && options.restoreOnFailure !== false) {
      try {
        await bridgeClient.send('scene_restore_checkpoint', { data: checkpoint.data }, 20_000);
        checkpointRestored = true;
      } catch {}
    }
    return {
      executed: true,
      operation,
      risk,
      status: 'STRUCTURED_FAILURE',
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      bridgeRecovered: recovered,
      processRestarted: restarted,
      checkpointId: checkpoint?.checkpointId,
      checkpointRestored,
      safeAlternatives: safeAlternativeFor(operation),
    };
  }
}
