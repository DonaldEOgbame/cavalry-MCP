import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';

export interface ConnectParams {
  sourceLayerId: string;
  sourceAttr: string;
  targetLayerId: string;
  targetAttr: string;
  force?: boolean;
}

export async function graphConnect(params: ConnectParams): Promise<Record<string, unknown>> {
  const payload = {
    ...params,
    sourceLayerId: identityResolver.resolveToLayerId(params.sourceLayerId),
    targetLayerId: identityResolver.resolveToLayerId(params.targetLayerId),
  };
  const res = await bridgeClient.send<Record<string, unknown>>('graph_connect', payload);
  return res.result!;
}

export async function graphDisconnect(params: Omit<ConnectParams, 'force'>): Promise<Record<string, unknown>> {
  const payload = {
    ...params,
    sourceLayerId: identityResolver.resolveToLayerId(params.sourceLayerId),
    targetLayerId: identityResolver.resolveToLayerId(params.targetLayerId),
  };
  const res = await bridgeClient.send<Record<string, unknown>>('graph_disconnect', payload);
  return res.result!;
}

export async function graphDisconnectInput(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('graph_disconnect_input', { layerId: resolved, attrPath });
  return res.result!;
}

export async function graphDisconnectOutputs(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('graph_disconnect_outputs', { layerId: resolved, attrPath });
  return res.result!;
}

export async function graphInputs(layerId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('graph_inputs', { layerId: resolved });
  return res.result!;
}

export async function graphOutputs(layerId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('graph_outputs', { layerId: resolved });
  return res.result!;
}

export async function graphInspect(layerId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('graph_inspect', { layerId: resolved });
  return res.result!;
}

export async function graphValidateConnection(params: Omit<ConnectParams, 'force'>): Promise<Record<string, unknown>> {
  const payload = {
    ...params,
    sourceLayerId: identityResolver.resolveToLayerId(params.sourceLayerId),
    targetLayerId: identityResolver.resolveToLayerId(params.targetLayerId),
  };
  const res = await bridgeClient.send<Record<string, unknown>>('graph_validate_connection', payload);
  return res.result!;
}
