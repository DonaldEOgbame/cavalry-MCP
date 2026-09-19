import { motionFadeIn, motionFadeOut, motionSlide, motionScale } from './animation-presets.js';

export async function transitionSlide(incomingLayerId: string, outgoingLayerId: string, transitionFrame: number, duration: number = 20) {
  await motionSlide(incomingLayerId, transitionFrame, duration, 0, 150, 'SlowOut');
  await motionFadeIn(incomingLayerId, transitionFrame, duration);

  await motionSlide(outgoingLayerId, transitionFrame, duration, 0, -150, 'SlowIn');
  await motionFadeOut(outgoingLayerId, transitionFrame, duration);

  return {
    transition: 'slide',
    frame: transitionFrame,
    duration,
  };
}

export async function transitionCrossFade(incomingLayerId: string, outgoingLayerId: string, transitionFrame: number, duration: number = 15) {
  await motionFadeIn(incomingLayerId, transitionFrame, duration);
  await motionFadeOut(outgoingLayerId, transitionFrame, duration);

  return {
    transition: 'crossFade',
    frame: transitionFrame,
    duration,
  };
}
