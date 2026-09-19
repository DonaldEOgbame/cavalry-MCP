import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { filesystem } from '../utils/filesystem.js';
import fs from 'node:fs';

export async function layersSerialize(layerIds: string[], withConnections?: boolean): Promise<{ serializedJson: string; layerCount: number }> {
  const resolved = layerIds.map(id => identityResolver.resolveToLayerId(id));
  const res = await bridgeClient.send<any>('layers_serialize', { layerIds: resolved, withConnections });
  return res.result!;
}

export async function layersDeserialize(jsonString: string): Promise<{ deserialized: boolean }> {
  identityResolver.invalidate();
  const res = await bridgeClient.send<any>('layers_deserialize', { jsonString });
  return res.result!;
}

export async function componentExport(filePath: string): Promise<{ exported: boolean; filePath: string }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'component_export');
  const res = await bridgeClient.send<any>('component_export', { filePath: safePath });
  return res.result!;
}

export async function componentImport(filePath: string): Promise<{ imported: boolean; path: string }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'component_import');
  const res = await bridgeClient.send<any>('scene_import', { path: safePath });
  return res.result!;
}

export async function templateCreate(name: string, layerIds: string[], storagePath: string): Promise<{ name: string; templatePath: string }> {
  const safePath = filesystem.assertAllowedPath(storagePath, 'template_create');
  const { serializedJson } = await layersSerialize(layerIds, true);
  fs.writeFileSync(safePath, serializedJson, 'utf8');
  return { name, templatePath: safePath };
}

export async function templateInstantiate(templatePath: string): Promise<{ instantiated: boolean }> {
  const safePath = filesystem.assertAllowedPath(templatePath, 'template_instantiate');
  const content = fs.readFileSync(safePath, 'utf8');
  const res = await layersDeserialize(content);
  return { instantiated: res.deserialized };
}
