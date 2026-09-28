import crypto from 'node:crypto';
import {
  CompiledMotionOperation,
  CompiledProjectPlan,
  CompiledScenePlan,
  MotionBehavior,
  MotionElement,
  MotionProjectSpec,
  MotionScene,
  TypographyStyle,
} from './types.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function motionHash(value: unknown): string {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function color(project: MotionProjectSpec, value: string): string {
  return project.designTokens?.colors?.[value] ?? value;
}

function alignment(value: TypographyStyle['alignment']): number {
  return value === 'left' ? 0 : value === 'right' ? 2 : 1;
}

interface SceneCompiler {
  operations: CompiledMotionOperation[];
  keyframes: number;
  add(op: string, params: Record<string, unknown>, id: string, saveAs?: string): void;
  key(layerId: string, attrPath: string, frame: number, value: unknown, id: string): void;
  ease(layerId: string, attrPath: string, frame: number, easing: string, id: string): void;
}

function compiler(): SceneCompiler {
  const state: SceneCompiler = {
    operations: [],
    keyframes: 0,
    add(op, params, id, saveAs) { state.operations.push({ id, op, params, ...(saveAs ? { saveAs } : {}) }); },
    key(layerId, attrPath, frame, value, id) {
      state.keyframes += 1;
      state.add('keyframe_create', { layerId, attrPath, frame: Math.max(0, Math.round(frame)), value }, id);
    },
    ease(layerId, attrPath, frame, easing, id) {
      state.add('keyframe_magic_easing', { layerId, attrPath, frame: Math.max(0, Math.round(frame)), easingType: easing }, id);
    },
  };
  return state;
}

function position(element: MotionElement): { x: number; y: number } {
  return element.position ?? { x: 0, y: 0 };
}

function scale(element: MotionElement): { x: number; y: number } {
  if (typeof element.scale === 'number') return { x: element.scale, y: element.scale };
  return element.scale ?? { x: 1, y: 1 };
}

function resolveTransition(project: MotionProjectSpec, reference: MotionScene['transitionIn']): MotionBehavior | undefined {
  if (!reference) return undefined;
  if (typeof reference === 'string') return { type: reference };
  const definition = project.transitions?.[reference.transitionId];
  if (!definition) throw new Error(`Unknown transition definition '${reference.transitionId}'.`);
  return {
    type: definition.primitive,
    durationFrames: definition.durationFrames,
    amount: definition.amount,
    easing: definition.easing,
  };
}

function compileBehavior(c: SceneCompiler, project: MotionProjectSpec, scene: MotionScene, element: MotionElement, symbol: string, behavior: MotionBehavior, sceneStart: number, sceneEnd: number, index: number): void {
  const start = sceneStart + (behavior.startFrame ?? 0);
  const duration = behavior.durationFrames ?? project.globalTiming?.defaultTransitionFrames ?? Math.min(18, Math.max(6, Math.floor(scene.durationFrames / 4)));
  const end = Math.min(sceneEnd, start + duration);
  const amount = behavior.amount ?? 120;
  const easing = behavior.easing ?? 'SlowOut';
  const pos = position(element);
  const baseScale = scale(element);
  const prefix = `${safeId(scene.id)}-${safeId(element.id)}-${index}`;
  const pair = (attr: string, from: unknown, to: unknown) => {
    c.key(symbol, attr, start, from, `${prefix}-${attr}-from`);
    c.key(symbol, attr, end, to, `${prefix}-${attr}-to`);
    // One primary eased channel is sufficient for coupled transforms. Opacity,
    // tracking, and scale.y follow Cavalry's default Bezier interpolation and
    // avoid redundant native magic-easing calls.
    if (attr !== 'opacity' && attr !== 'scale.y' && attr !== 'letterSpacing') c.ease(symbol, attr, start, easing, `${prefix}-${attr}-ease`);
  };

  switch (behavior.type) {
    case 'enterUp': pair('position.y', pos.y + amount, pos.y); pair('opacity', 0, element.opacity ?? 100); break;
    case 'enterDown': pair('position.y', pos.y - amount, pos.y); pair('opacity', 0, element.opacity ?? 100); break;
    case 'enterLeft': pair('position.x', pos.x - amount, pos.x); pair('opacity', 0, element.opacity ?? 100); break;
    case 'enterRight': pair('position.x', pos.x + amount, pos.x); pair('opacity', 0, element.opacity ?? 100); break;
    case 'verticalRoll': {
      pair('position.y', pos.y + amount, pos.y);
      const exitStart = Math.max(end, sceneEnd - duration);
      c.key(symbol, 'position.y', exitStart, pos.y, `${prefix}-roll-hold`);
      c.key(symbol, 'position.y', sceneEnd, pos.y - amount, `${prefix}-roll-exit`);
      c.ease(symbol, 'position.y', exitStart, 'SlowIn', `${prefix}-roll-exit-ease`);
      pair('opacity', 0, element.opacity ?? 100);
      break;
    }
    case 'wordSwap': pair('opacity', 0, element.opacity ?? 100); pair('position.y', pos.y + amount * 0.35, pos.y); break;
    case 'progressiveBuild': pair('opacity', 0, element.opacity ?? 100); pair('letterSpacing', (element.tracking ?? 0) + amount * 0.08, element.tracking ?? 0); break;
    case 'textReflow': pair('position.x', pos.x - amount * 0.35, pos.x); pair('letterSpacing', (element.tracking ?? 0) + amount * 0.05, element.tracking ?? 0); break;
    case 'pushTransition': pair('position.x', pos.x + amount, pos.x); break;
    case 'scaleTakeover': pair('scale.x', baseScale.x * 0.45, baseScale.x); pair('scale.y', baseScale.y * 0.45, baseScale.y); pair('opacity', 0, element.opacity ?? 100); break;
    case 'scaleTransfer': pair('scale.x', baseScale.x * 1.35, baseScale.x); pair('scale.y', baseScale.y * 1.35, baseScale.y); break;
    case 'zoomThrough': {
      pair('scale.x', baseScale.x * 0.7, baseScale.x);
      pair('scale.y', baseScale.y * 0.7, baseScale.y);
      const exitStart = Math.max(end, sceneEnd - duration);
      c.key(symbol, 'scale.x', exitStart, baseScale.x, `${prefix}-zoom-hold-x`);
      c.key(symbol, 'scale.x', sceneEnd, baseScale.x * 4, `${prefix}-zoom-exit-x`);
      c.key(symbol, 'scale.y', exitStart, baseScale.y, `${prefix}-zoom-hold-y`);
      c.key(symbol, 'scale.y', sceneEnd, baseScale.y * 4, `${prefix}-zoom-exit-y`);
      break;
    }
    case 'maskedReveal': pair('scale.x', 0.01, baseScale.x); pair('opacity', 0, element.opacity ?? 100); break;
    case 'trackingExpansion': pair('letterSpacing', Number(behavior.from ?? element.tracking ?? 0), Number(behavior.to ?? (element.tracking ?? 0) + amount * 0.1)); break;
    case 'colorSnap': {
      const to = color(project, String(behavior.to ?? element.color ?? '#ffffff'));
      // Cavalry 2.7.2 does not reliably expose parent-colour keyframe readback.
      // Compile a colour snap as a static target colour plus a one-frame stepped
      // visibility cut; scene/background colour changes remain deterministic.
      c.add('attribute_set', { layerId: symbol, attrPath: 'material.materialColor', value: to }, `${prefix}-colour-target`);
      c.key(symbol, 'opacity', start, 0, `${prefix}-colour-before`);
      c.key(symbol, 'opacity', Math.min(sceneEnd, start + 1), element.opacity ?? 100, `${prefix}-colour-after`);
      c.add('keyframe_set_interpolation', { layerId: symbol, attrPath: 'opacity', frame: start, type: 2 }, `${prefix}-colour-step`);
      break;
    }
    case 'hardCut': {
      const value = element.opacity ?? 100;
      c.key(symbol, 'opacity', start, 0, `${prefix}-cut-before`);
      c.key(symbol, 'opacity', Math.min(sceneEnd, start + 1), value, `${prefix}-cut-after`);
      c.add('keyframe_set_interpolation', { layerId: symbol, attrPath: 'opacity', frame: start, type: 2 }, `${prefix}-cut-step`);
      break;
    }
  }
}

function compileScene(project: MotionProjectSpec, scene: MotionScene, startFrame: number): CompiledScenePlan {
  const c = compiler();
  const endFrame = startFrame + scene.durationFrames - 1;
  const sceneKey = safeId(scene.id);
  const elementSymbols = new Map<string, string>();

  c.add('marker_create', { frame: startFrame, label: scene.name ?? scene.id, color: '#7c3aed' }, `${sceneKey}-marker`);

  scene.elements.forEach((element, index) => {
    const symbol = `$${sceneKey}_${safeId(element.id)}`;
    elementSymbols.set(element.id, symbol);
    const layerType = element.kind === 'text' ? 'textShape' : element.kind === 'group' ? 'group' : undefined;
    const elementKey = safeId(element.id);
    if (layerType) c.add('layer_create', { layerType, name: element.name ?? `${scene.id}/${element.id}` }, `${sceneKey}-${elementKey}-create`, symbol);
    else c.add('layer_create_primitive', { primitiveType: element.kind, name: element.name ?? `${scene.id}/${element.id}` }, `${sceneKey}-${elementKey}-create`, symbol);

    const attrs: Record<string, unknown> = {
      position: position(element), scale: scale(element), opacity: element.opacity ?? 100,
    };
    if (element.rotation !== undefined) attrs.rotation = element.rotation;
    if (element.kind === 'text') {
      const style = element.style ? project.typographyStyles?.[element.style] : undefined;
      attrs.text = { text: element.text ?? '', overrides: [] };
      if (style) {
        attrs.font = { font: style.fontFamily, style: style.fontStyle ?? 'Regular' };
        attrs.fontSize = style.fontSize;
        attrs.horizontalAlignment = alignment(style.alignment);
        attrs.letterSpacing = element.tracking ?? style.tracking ?? 0;
        if (style.lineHeight !== undefined) attrs.lineSpacing = style.lineHeight;
        attrs['material.materialColor'] = color(project, element.color ?? style.color ?? '#ffffff');
      } else {
        if (element.tracking !== undefined) attrs.letterSpacing = element.tracking;
        if (element.lineHeight !== undefined) attrs.lineSpacing = element.lineHeight;
        attrs['material.materialColor'] = color(project, element.color ?? '#ffffff');
      }
    } else if (element.kind !== 'group') {
      attrs['generator.dimensions'] = { x: element.width ?? 100, y: element.height ?? 100 };
      attrs['material.materialColor'] = color(project, element.color ?? '#ffffff');
    }
    c.add('attribute_set_many', { layerId: symbol, attributes: attrs }, `${sceneKey}-${elementKey}-attributes`);
    const visible = element.opacity ?? 100;
    if (startFrame > 0) c.key(symbol, 'opacity', startFrame - 1, 0, `${sceneKey}-${index}-hidden-before`);
    c.key(symbol, 'opacity', startFrame, visible, `${sceneKey}-${index}-visible-start`);
    c.key(symbol, 'opacity', endFrame, visible, `${sceneKey}-${index}-visible-end`);
    c.key(symbol, 'opacity', endFrame + 1, 0, `${sceneKey}-${index}-hidden-after`);
    const transitionIn = resolveTransition(project, scene.transitionIn);
    const transitionOut = resolveTransition(project, scene.transitionOut);
    const motions: MotionBehavior[] = element.motions?.length ? [...element.motions] : transitionIn ? [transitionIn] : [];
    if (transitionOut) {
      const duration = transitionOut.durationFrames ?? project.globalTiming?.defaultTransitionFrames ?? 18;
      motions.push({ ...transitionOut, startFrame: Math.max(0, scene.durationFrames - duration) });
    }
    motions.forEach((behavior, motionIndex) => compileBehavior(c, project, scene, element, symbol, behavior, startFrame, endFrame, motionIndex));
  });

  // Parent after every scene element exists so manifests do not depend on
  // parents appearing before their children in the element array.
  for (const element of scene.elements) {
    if (!element.parentId) continue;
    const child = elementSymbols.get(element.id);
    const parent = elementSymbols.get(element.parentId);
    if (child && parent) c.add('layer_parent', { childLayerId: child, parentLayerId: parent }, `${sceneKey}-${safeId(element.id)}-parent`);
  }

  const background = `$${sceneKey}_background`;
  c.add('layer_create_primitive', { primitiveType: 'rectangle', name: `${scene.name ?? scene.id} Background` }, `${sceneKey}-background-create`, background);
  c.add('attribute_set_many', { layerId: background, attributes: {
    'generator.dimensions': { x: project.resolution.width, y: project.resolution.height },
    'material.materialColor': color(project, scene.background), position: { x: 0, y: 0 }, opacity: 100,
  } }, `${sceneKey}-background-attributes`);
  if (startFrame > 0) c.key(background, 'opacity', startFrame - 1, 0, `${sceneKey}-background-before`);
  c.key(background, 'opacity', startFrame, 100, `${sceneKey}-background-start`);
  c.key(background, 'opacity', endFrame, 100, `${sceneKey}-background-end`);
  c.key(background, 'opacity', endFrame + 1, 0, `${sceneKey}-background-after`);
  const firstElement = scene.elements[0] ? elementSymbols.get(scene.elements[0].id) : undefined;
  if (firstElement) c.add('layer_reorder', { layerId: background, underLayerId: firstElement }, `${sceneKey}-background-order`);

  return {
    sceneId: scene.id,
    startFrame,
    endFrame,
    hash: motionHash(scene),
    operations: c.operations,
    expectedLayers: scene.elements.length + 1,
    expectedKeyframes: c.keyframes,
  };
}

export function compileMotionProject(project: MotionProjectSpec): CompiledProjectPlan {
  let cursor = 0;
  const gap = project.globalTiming?.sceneGapFrames ?? 0;
  const scenes = project.scenes.map((scene) => {
    const compiled = compileScene(project, scene, cursor);
    cursor = compiled.endFrame + 1 + gap;
    return compiled;
  });
  return {
    projectId: project.id,
    hash: motionHash(project),
    durationFrames: Math.max(1, cursor - gap),
    scenes,
    operationCount: scenes.reduce((sum, scene) => sum + scene.operations.length, 0),
    expectedLayers: scenes.reduce((sum, scene) => sum + scene.expectedLayers, 0),
    expectedKeyframes: scenes.reduce((sum, scene) => sum + scene.expectedKeyframes, 0),
  };
}

export function estimateLegacyCallCount(plan: CompiledProjectPlan): number {
  return plan.operationCount + plan.scenes.length * 2 + 10;
}
