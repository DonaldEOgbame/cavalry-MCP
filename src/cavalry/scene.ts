import { bridgeClient } from '../bridge/client.js';
import { filesystem } from '../utils/filesystem.js';
import { identityResolver } from '../utils/ids.js';

async function assertSceneCanBeDiscarded(force: boolean, operation: string): Promise<void> {
  if (force) return;
  const dirty = await sceneHasUnsavedChanges();
  if (dirty) {
    const { CavalryError } = await import('../mcp/errors.js');
    throw new CavalryError({
      code: 'SCENE_DIRTY',
      message: 'The current Cavalry scene has unsaved changes.',
      operation,
      suggestion: 'Save the scene first, or retry with force=true to discard the changes.',
    });
  }
}

export async function sceneNew(force: boolean = false): Promise<{ success: boolean }> {
  await assertSceneCanBeDiscarded(force, 'scene_new');
  const res = await bridgeClient.send<{ success: boolean }>('scene_new');
  identityResolver.invalidate();
  return res.result!;
}

export async function sceneOpen(filePath: string, force?: boolean): Promise<{ path: string; activeComp: string }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'scene_open');
  await assertSceneCanBeDiscarded(force === true, 'scene_open');
  const res = await bridgeClient.send<{ path: string; activeComp: string }>('scene_open', { path: safePath, force });
  identityResolver.invalidate();
  return res.result!;
}

export async function sceneSave(): Promise<{ saved: boolean; path: string }> {
  const res = await bridgeClient.send<{ saved: boolean; path: string }>('scene_save');
  return res.result!;
}

export async function sceneSaveAs(filePath: string): Promise<{ saved: boolean; filePath: string }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'scene_save_as');
  const res = await bridgeClient.send<{ saved: boolean; filePath: string }>('scene_save_as', { filePath: safePath });
  return res.result!;
}

export async function sceneHasUnsavedChanges(): Promise<boolean> {
  const res = await bridgeClient.send<{ unsaved: boolean }>('scene_has_unsaved_changes');
  return res.result!.unsaved;
}

export async function sceneImport(filePath: string): Promise<{ imported: boolean; path: string }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'scene_import');
  const res = await bridgeClient.send<{ imported: boolean; path: string }>('scene_import', { path: safePath });
  return res.result!;
}

export async function sceneInspect(detailed?: boolean): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('scene_inspect', { detailed });
  return res.result!;
}

export async function sceneDescribe(compact?: boolean): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('scene_describe', { compact });
  return res.result!;
}

export async function sceneCheckpoint(): Promise<{ checkpointId: string; layerCount: number; data: string }> {
  const res = await bridgeClient.send<{ checkpointId: string; layerCount: number; data: string }>('scene_checkpoint');
  return res.result!;
}

export async function sceneRestoreCheckpoint(data: string): Promise<{ restored: boolean }> {
  identityResolver.invalidate();
  const res = await bridgeClient.send<{ restored: boolean }>('scene_restore_checkpoint', { data });
  return res.result!;
}

export async function sceneSnapshot(): Promise<{ timestamp: number; state: string }> {
  const res = await bridgeClient.send<{ timestamp: number; state: string }>('scene_snapshot');
  return res.result!;
}

export interface SceneDiffResult {
  addedLayers: string[];
  removedLayers: string[];
  modifiedLayers: string[];
  rawDiffSummary: string;
}

export function computeSceneDiff(beforeJson: string, afterJson: string): SceneDiffResult {
  let beforeData: any = {};
  let afterData: any = {};
  try { beforeData = JSON.parse(beforeJson); } catch {}
  try { afterData = JSON.parse(afterJson); } catch {}

  const beforeLayers = new Map<string, unknown>();
  const afterLayers = new Map<string, unknown>();

  const keyFor = (layer: any): string | undefined => layer?.uuid || layer?.id || layer?.layerId || layer?.name;
  const stableJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  };

  if (Array.isArray(beforeData.layers)) {
    beforeData.layers.forEach((l: any) => {
      const key = keyFor(l);
      if (key) beforeLayers.set(key, l);
    });
  }
  if (Array.isArray(afterData.layers)) {
    afterData.layers.forEach((l: any) => {
      const key = keyFor(l);
      if (key) afterLayers.set(key, l);
    });
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [id, layer] of afterLayers) {
    if (!beforeLayers.has(id)) added.push(id);
    else if (stableJson(beforeLayers.get(id)) !== stableJson(layer)) modified.push(id);
  }
  for (const id of beforeLayers.keys()) {
    if (!afterLayers.has(id)) removed.push(id);
  }

  const summary = [
    added.length ? `+ ${added.length} added layer(s): ${added.join(', ')}` : '',
    removed.length ? `- ${removed.length} removed layer(s): ${removed.join(', ')}` : '',
    modified.length ? `~ ${modified.length} modified layer(s): ${modified.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return {
    addedLayers: added,
    removedLayers: removed,
    modifiedLayers: modified,
    rawDiffSummary: summary || 'No structural layer changes detected.',
  };
}
