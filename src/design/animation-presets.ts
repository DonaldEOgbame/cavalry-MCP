import { keyframeCreate, keyframeMagicEasing } from '../cavalry/animation.js';
import { identityResolver } from '../utils/ids.js';
import { attributeGet } from '../cavalry/attributes.js';

export async function motionFadeIn(layerId: string, startFrame: number, duration: number = 20, easing: string = 'SlowOut') {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;
  await keyframeCreate(resolved, 'opacity', startFrame, 0);
  await keyframeCreate(resolved, 'opacity', endFrame, 100);
  await keyframeMagicEasing(resolved, 'opacity', startFrame, easing);
  return { layerId: resolved, preset: 'fadeIn', startFrame, endFrame };
}

export async function motionFadeOut(layerId: string, startFrame: number, duration: number = 20, easing: string = 'SlowIn') {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;
  await keyframeCreate(resolved, 'opacity', startFrame, 100);
  await keyframeCreate(resolved, 'opacity', endFrame, 0);
  await keyframeMagicEasing(resolved, 'opacity', startFrame, easing);
  return { layerId: resolved, preset: 'fadeOut', startFrame, endFrame };
}

export async function motionSlide(
  layerId: string,
  startFrame: number,
  duration: number = 30,
  deltaX: number = 0,
  deltaY: number = 100,
  easing: string = 'SlowOut',
) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;
  const current = (await attributeGet(resolved, 'position')).value as { x?: number; y?: number } | null;
  const destinationX = current?.x ?? 0;
  const destinationY = current?.y ?? 0;

  if (deltaX !== 0) {
    await keyframeCreate(resolved, 'position.x', startFrame, destinationX + deltaX);
    await keyframeCreate(resolved, 'position.x', endFrame, destinationX);
    await keyframeMagicEasing(resolved, 'position.x', startFrame, easing);
  }
  if (deltaY !== 0) {
    await keyframeCreate(resolved, 'position.y', startFrame, destinationY + deltaY);
    await keyframeCreate(resolved, 'position.y', endFrame, destinationY);
    await keyframeMagicEasing(resolved, 'position.y', startFrame, easing);
  }

  return { layerId: resolved, preset: 'slide', startFrame, endFrame };
}

export async function motionScale(
  layerId: string,
  startFrame: number,
  duration: number = 25,
  fromScale: number = 0,
  toScale: number = 1,
  easing: string = 'SlowOut',
) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;

  await keyframeCreate(resolved, 'scale.x', startFrame, fromScale);
  await keyframeCreate(resolved, 'scale.x', endFrame, toScale);
  await keyframeMagicEasing(resolved, 'scale.x', startFrame, easing);

  await keyframeCreate(resolved, 'scale.y', startFrame, fromScale);
  await keyframeCreate(resolved, 'scale.y', endFrame, toScale);
  await keyframeMagicEasing(resolved, 'scale.y', startFrame, easing);

  return { layerId: resolved, preset: 'scale', startFrame, endFrame };
}

export async function motionPop(layerId: string, startFrame: number, duration: number = 30) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const midFrame = startFrame + Math.floor(duration * 0.6);
  const endFrame = startFrame + duration;

  await keyframeCreate(resolved, 'scale.x', startFrame, 0);
  await keyframeCreate(resolved, 'scale.x', midFrame, 1.15);
  await keyframeCreate(resolved, 'scale.x', endFrame, 1.0);
  await keyframeMagicEasing(resolved, 'scale.x', startFrame, 'SlowOut');
  await keyframeMagicEasing(resolved, 'scale.x', midFrame, 'SlowInSlowOut');

  await keyframeCreate(resolved, 'scale.y', startFrame, 0);
  await keyframeCreate(resolved, 'scale.y', midFrame, 1.15);
  await keyframeCreate(resolved, 'scale.y', endFrame, 1.0);
  await keyframeMagicEasing(resolved, 'scale.y', startFrame, 'SlowOut');
  await keyframeMagicEasing(resolved, 'scale.y', midFrame, 'SlowInSlowOut');

  return { layerId: resolved, preset: 'pop', startFrame, endFrame };
}

export async function motionBounce(layerId: string, startFrame: number, duration: number = 40, height: number = -150) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;
  const current = (await attributeGet(resolved, 'position.y')).value;
  const destinationY = typeof current === 'number' ? current : 0;

  await keyframeCreate(resolved, 'position.y', startFrame, destinationY + height);
  await keyframeCreate(resolved, 'position.y', endFrame, destinationY);
  await keyframeMagicEasing(resolved, 'position.y', startFrame, 'BounceOut');

  return { layerId: resolved, preset: 'bounce', startFrame, endFrame };
}
