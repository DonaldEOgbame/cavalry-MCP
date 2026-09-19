import { bridgeClient } from '../bridge/client.js';
import { filesystem } from '../utils/filesystem.js';

const FILE_OPERATIONS = new Set([
  'viewport_capture',
  'scene_export_copy',
  'component_export_selected',
  'project_set',
  'asset_smart_folder_create',
  'render_item_set_output',
]);

/**
 * Thin typed-boundary for documented desktop APIs whose data shapes are
 * discovered at runtime. Safety-sensitive filesystem values are still checked
 * on the MCP side before crossing into Cavalry.
 */
export async function parityCall<T = unknown>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const safeParams = { ...params };
  if (FILE_OPERATIONS.has(operation)) {
    const key = operation === 'project_set' || operation === 'asset_smart_folder_create' ? 'path' : 'filePath';
    const value = safeParams[key];
    if (typeof value === 'string') safeParams[key] = filesystem.assertAllowedPath(value, operation);
  }
  return (await bridgeClient.send<T>(operation, safeParams)).result!;
}
