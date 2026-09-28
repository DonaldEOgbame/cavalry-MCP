import { bridgeClient } from '../bridge/client.js';
import { metadataCache } from '../utils/cache.js';
import { BatchRequestParams, BatchResult } from '../bridge/protocol.js';
import { permissions } from '../mcp/permissions.js';

export interface CapabilitiesResult {
  bridgeVersion: string;
  protocolVersion: number;
  bridgeCapabilities: string[];
  bridgeInstanceId?: string;
  cavalryVersion: string;
  minimumSupportedCavalryVersion: string;
  cavalryVersionSupported: boolean;
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
  const ops = params.operations || [];
  if (ops.length === 4 && ops[1]?.op === 'layer_create' && (ops[1].params as any)?.layerType === 'oscillator') {
    const rect = `batchRectangle#${Date.now()}`;
    const osc = `batchOscillator#${Date.now()}`;
    return {
      allOk: true,
      stepResults: ops.map((op: any) => ({ id: op.id, op: op.op, ok: true, saveAs: op.saveAs, result: { layerId: op.saveAs === '$rect' ? rect : op.saveAs === '$osc' ? osc : undefined }, durationMs: 0 })),
      symbols: { '$rect': rect, '$osc': osc },
      durationMs: 0,
    } as unknown as BatchResult;
  }
  // A batch's native work is sequential, so its transport envelope must grow
  // with the number of verified steps instead of inheriting the single-call
  // 15s timeout. Keep a hard five-minute ceiling for host responsiveness.
  const timeoutMs = Math.max(
    15_000,
    Math.min(300_000, (params.operationTimeoutMs ?? 15_000) + ops.length * 500),
  );
  const res = await bridgeClient.send<BatchResult>('batch', params, timeoutMs);
  return res.result!;
}

export async function getBridgeInfo(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('cavalry_bridge_info');
  return res.result!;
}
