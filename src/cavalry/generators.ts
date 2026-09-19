import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { metadataCache } from '../utils/cache.js';

export async function generatorList(layerId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('generator_list', { layerId: resolved });
  return res.result!;
}

export async function generatorCurrent(layerId: string, generatorSlot?: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('generator_current', { layerId: resolved, generatorSlot });
  return res.result!;
}

export async function generatorSet(layerId: string, generatorType: string, generatorSlot?: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  // Changing generator alters layer attributes, so invalidate schema caches for this layer
  metadataCache.invalidatePrefix(`attr_${resolved}`);
  const res = await bridgeClient.send<Record<string, unknown>>('generator_set', {
    layerId: resolved,
    generatorType,
    generatorSlot,
  });
  return res.result!;
}

export async function generatorDescribe(layerId: string, generatorSlot?: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('generator_describe', { layerId: resolved, generatorSlot });
  return res.result!;
}
