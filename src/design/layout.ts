import { attributeSet, attributeSetMany, attributeGet } from '../cavalry/attributes.js';
import { layerCreatePrimitive } from '../cavalry/layers.js';
import { compositionGetActive } from '../cavalry/compositions.js';
import { identityResolver } from '../utils/ids.js';

export async function designCenter(layerId: string) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  await attributeSet(resolved, 'position', { x: 0, y: 0 });
  return { layerId: resolved, centered: true, position: { x: 0, y: 0 } };
}

export async function designCreateBackground(color: string = '#121316', name: string = 'Background') {
  const comp = await compositionGetActive();
  const width = (comp.resolution as any)?.x || 1920;
  const height = (comp.resolution as any)?.y || 1080;

  const bg = await layerCreatePrimitive('rectangle', name);
  await attributeSetMany(bg.layerId, {
    'generator.dimensions': { x: width, y: height },
    'material.materialColor': color,
    position: { x: 0, y: 0 },
  });

  return bg;
}

export async function designAlign(layerIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
  const resolvedIds = layerIds.map(id => identityResolver.resolveToLayerId(id));
  if (resolvedIds.length === 0) return { aligned: false };

  // Calculate target coordinate based on first layer or average
  const firstId = resolvedIds[0];
  const firstPos = (await attributeGet(firstId, 'position')).value as any || { x: 0, y: 0 };

  for (let i = 1; i < resolvedIds.length; i++) {
    const id = resolvedIds[i];
    if (alignment === 'left' || alignment === 'right' || alignment === 'center') {
      await attributeSet(id, 'position.x', firstPos.x);
    } else {
      await attributeSet(id, 'position.y', firstPos.y);
    }
  }

  return { aligned: true, count: resolvedIds.length, alignment };
}

export async function designDistribute(layerIds: string[], axis: 'x' | 'y' = 'x', spacing: number = 50) {
  const resolvedIds = layerIds.map(id => identityResolver.resolveToLayerId(id));
  if (resolvedIds.length <= 1) return { distributed: false };

  const firstPos = (await attributeGet(resolvedIds[0], 'position')).value as any || { x: 0, y: 0 };
  let current = axis === 'x' ? firstPos.x : firstPos.y;

  for (let i = 1; i < resolvedIds.length; i++) {
    current += spacing;
    const attr = axis === 'x' ? 'position.x' : 'position.y';
    await attributeSet(resolvedIds[i], attr, current);
  }

  return { distributed: true, count: resolvedIds.length, axis, spacing };
}
