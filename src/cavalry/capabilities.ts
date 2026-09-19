import { bridgeClient } from '../bridge/client.js';
import { metadataCache } from '../utils/cache.js';
import { BatchRequestParams, BatchResult } from '../bridge/protocol.js';
import { permissions } from '../mcp/permissions.js';

export interface CapabilitiesResult {
  bridgeVersion: string;
  bridgeInstanceId?: string;
  cavalryVersion: string;
  layerTypesCount: number;
  supportedLayerTypes: Array<{ name: string; type: string }>;
  supportsUUID: boolean;
  supportsExactTangents: boolean;
  supportsVelocity: boolean;
  supportsRenderQueue: boolean;
  supportsSerialization: boolean;
  supportsMarkers: boolean;
  supportsSVGToLayers: boolean;
  supportsEditablePaths: boolean;
  rawScriptingAllowed: boolean;
}

export async function getCapabilities(forceRefresh: boolean = false): Promise<CapabilitiesResult> {
  const cacheKey = 'cavalry_capabilities';
  if (!forceRefresh) {
    const cached = metadataCache.get<CapabilitiesResult>(cacheKey);
    if (cached) return { ...cached, rawScriptingAllowed: permissions.isRawScriptAllowed() };
  }

  const res = await bridgeClient.send<CapabilitiesResult>('cavalry_capabilities');
  const caps = { ...res.result!, rawScriptingAllowed: permissions.isRawScriptAllowed() };
  metadataCache.set(cacheKey, caps, 600000); // 10 minutes cache
  return caps;
}

export async function executeBatch(params: BatchRequestParams): Promise<BatchResult> {
  const res = await bridgeClient.send<BatchResult>('batch', params);
  return res.result!;
}

export async function getBridgeInfo(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('cavalry_bridge_info');
  return res.result!;
}
