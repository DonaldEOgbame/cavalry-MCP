import { bridgeClient } from '../bridge/client.js';
import { identityResolver, LayerIdentity } from '../utils/ids.js';
import { filesystem } from '../utils/filesystem.js';

export interface AssetInfo {
  assetId: string;
  name: string;
  type: string;
  filePath: string;
  isFileAsset?: boolean;
}

export async function assetList(topLevelOnly?: boolean): Promise<{ count: number; assets: AssetInfo[] }> {
  const res = await bridgeClient.send<any>('asset_list', { topLevelOnly });
  return res.result!;
}

export async function assetInspect(assetId: string): Promise<AssetInfo> {
  const resolved = identityResolver.resolveToLayerId(assetId);
  const res = await bridgeClient.send<AssetInfo>('asset_inspect', { assetId: resolved });
  return res.result!;
}

export async function assetImport(filePath: string, isSequence?: boolean): Promise<AssetInfo> {
  const safePath = filesystem.assertAllowedPath(filePath, 'asset_import');
  const res = await bridgeClient.send<AssetInfo>('asset_import', { filePath: safePath, isSequence });
  return res.result!;
}

export async function assetReload(assetId: string): Promise<{ assetId: string; reloaded: boolean }> {
  const resolved = identityResolver.resolveToLayerId(assetId);
  const res = await bridgeClient.send<any>('asset_reload', { assetId: resolved });
  return res.result!;
}

export async function assetReplace(assetId: string, newPath: string): Promise<{ assetId: string; newPath: string }> {
  const safePath = filesystem.assertAllowedPath(newPath, 'asset_replace');
  const resolved = identityResolver.resolveToLayerId(assetId);
  const res = await bridgeClient.send<any>('asset_replace', { assetId: resolved, newPath: safePath });
  return res.result!;
}

export async function assetDelete(assetId: string): Promise<{ assetId: string; deleted: boolean }> {
  const resolved = identityResolver.resolveToLayerId(assetId);
  const res = await bridgeClient.send<any>('asset_delete', { assetId: resolved });
  identityResolver.invalidate(resolved);
  return res.result!;
}

export async function assetAddToComposition(assetId: string): Promise<{ assetId: string; footageLayer: LayerIdentity }> {
  const resolved = identityResolver.resolveToLayerId(assetId);
  const res = await bridgeClient.send<any>('asset_add_to_composition', { assetId: resolved });
  if (res.result?.footageLayer) {
    identityResolver.register(res.result.footageLayer);
  }
  return res.result!;
}
