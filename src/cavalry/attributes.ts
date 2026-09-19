import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';

export async function attributeList(layerId: string): Promise<{ layerId: string; count: number; attributes: string[] }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_list', { layerId: resolved });
  return res.result!;
}

export async function attributeDescribe(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_describe', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeGet(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; value: unknown }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_get', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeGetMany(layerId: string, attrPaths: string[]): Promise<{ layerId: string; values: Record<string, unknown> }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_get_many', { layerId: resolved, attrPaths });
  return res.result!;
}

export async function attributeSet(layerId: string, attrPath: string, value: unknown): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_set', { layerId: resolved, attrPath, value });
  return res.result!;
}

export async function attributeSetMany(layerId: string, attributes: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_set_many', { layerId: resolved, attributes });
  return res.result!;
}

export async function attributeReset(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; value: unknown }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_reset', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeExists(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; exists: boolean }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_exists', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeAddDynamic(layerId: string, attrId: string, attrType: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_add_dynamic', { layerId: resolved, attrId, attrType });
  return res.result!;
}

export async function attributeRemoveDynamic(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_remove_dynamic', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeArrayAdd(layerId: string, attrId: string): Promise<{ layerId: string; attrId: string; newIndex: number }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_array_add', { layerId: resolved, attrId });
  return res.result!;
}

export async function attributeArrayRemove(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_array_remove', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeArrayReorder(layerId: string, attrId: string, fromIndex: number, toIndex: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('attribute_array_reorder', { layerId: resolved, attrId, fromIndex, toIndex });
  return res.result!;
}

export async function attributeExpressionGet(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; expression: string }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_expression_get', { layerId: resolved, attrPath });
  return res.result!;
}

export async function attributeExpressionSet(layerId: string, attrPath: string, expression: string): Promise<{ layerId: string; attrPath: string; expression: string }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_expression_set', { layerId: resolved, attrPath, expression });
  return res.result!;
}

export async function attributeExpressionRemove(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('attribute_expression_remove', { layerId: resolved, attrPath });
  return res.result!;
}
