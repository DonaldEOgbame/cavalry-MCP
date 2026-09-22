import { bridgeClient } from '../bridge/client.js';
import { assetImport, assetAddToComposition, assetInspect } from './assets.js';
import { attributeSet } from './attributes.js';
import { identityResolver } from '../utils/ids.js';

export async function audioImport(filePath: string): Promise<any> {
  const asset = await assetImport(filePath, false);
  return asset;
}

export async function audioAddToComposition(assetId: string): Promise<any> {
  const footage = await assetAddToComposition(assetId);
  return footage;
}

export async function audioInspect(assetOrFootageId: string): Promise<any> {
  const resolved = identityResolver.resolveToLayerId(assetOrFootageId);
  return assetInspect(resolved);
}

export async function audioSetOffset(footageLayerId: string, frameOffset: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(footageLayerId);
  return attributeSet(resolved, 'frameOffset', frameOffset);
}

export async function audioSetInOut(footageLayerId: string, inFrame: number, outFrame: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(footageLayerId);
  await bridgeClient.send('layer_set_in_frame', { layerId: resolved, frame: inFrame });
  await bridgeClient.send('layer_set_out_frame', { layerId: resolved, frame: outFrame });
  return { layerId: resolved, inFrame, outFrame };
}

export async function audioSetVolume(footageLayerId: string, volume: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(footageLayerId);
  return attributeSet(resolved, 'playbackVolume', volume);
}
