#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Attr from '../src/cavalry/attributes.js';
import * as Graph from '../src/cavalry/graph.js';
import * as Gen from '../src/cavalry/generators.js';
import * as Anim from '../src/cavalry/animation.js';
import * as Typo from '../src/design/typography.js';
import * as Layout from '../src/design/layout.js';
import * as Path from '../src/cavalry/paths.js';
import * as Asset from '../src/cavalry/assets.js';
import * as Marker from '../src/cavalry/markers.js';
import * as Preview from '../src/preview/frames.js';
import * as Serial from '../src/cavalry/serialization.js';
import * as Parity from '../src/cavalry/parity.js';
import { bridgeClient } from '../src/bridge/client.js';
import { knowledgeEngine } from '../src/knowledge/engine.js';

const ROOT = resolve('knowledge/verified/golden-corpus');
const PROJECT_ID = 'cavalry-2.7.2-golden-corpus';

interface Expectation {
  nodeTypes: string[];
  minConnections?: number;
  animatedAttributes?: string[];
  hierarchy?: boolean;
}

interface GoldenScene {
  slug: string;
  description: string;
  recipe?: string;
  expected: Expectation;
  build: () => Promise<void>;
}

async function base(name: string, endFrame = 90) {
  await Scene.sceneNew(true);
  return Comp.compositionCreate({ name, width: 960, height: 540, fps: 30, startFrame: 0, endFrame });
}

async function shape(primitive: string, name: string, position?: { x: number; y: number }) {
  const layer = await Layer.layerCreatePrimitive(primitive, name);
  if (position) await Attr.attributeSet(layer.layerId, 'position', position);
  return layer;
}

async function connect(sourceLayerId: string, targetLayerId: string, targetAttr: string, sourceAttr = 'id') {
  return Graph.graphConnect({ sourceLayerId, sourceAttr, targetLayerId, targetAttr, force: true });
}

const scenes: GoldenScene[] = [
  {
    slug: '01-basic-transform-keyframes', description: 'Primitive shape with position, rotation, opacity, and eased keyframes.',
    recipe: 'shape-scale-pop', expected: { nodeTypes: ['basicShape'], animatedAttributes: ['position.x', 'position.y', 'opacity', 'scale.x', 'scale.y'], minConnections: 5 },
    build: async () => { await base('Basic Transform'); const s = await shape('ellipse', 'Animated Circle'); await Anim.keyframeCreate(s.layerId, 'position.x', 0, -250); await Anim.keyframeCreate(s.layerId, 'position.x', 45, 250); await Anim.keyframeCreate(s.layerId, 'position.y', 0, 140); await Anim.keyframeCreate(s.layerId, 'position.y', 45, -80); await Anim.keyframeCreate(s.layerId, 'opacity', 0, 0); await Anim.keyframeCreate(s.layerId, 'opacity', 12, 100); await Anim.keyframeCreate(s.layerId, 'scale.x', 0, 0); await Anim.keyframeCreate(s.layerId, 'scale.x', 18, 1.08); await Anim.keyframeCreate(s.layerId, 'scale.x', 28, 1); await Anim.keyframeCreate(s.layerId, 'scale.y', 0, 0); await Anim.keyframeCreate(s.layerId, 'scale.y', 18, 1.08); await Anim.keyframeCreate(s.layerId, 'scale.y', 28, 1); await Anim.keyframeMagicEasing(s.layerId, 'position.x', 0, 'SlowOut'); },
  },
  {
    slug: '02-exact-bezier-curve', description: 'Star animation with exact tangent and velocity control.',
    expected: { nodeTypes: ['basicShape'], animatedAttributes: ['position.x'], minConnections: 1 },
    build: async () => { await base('Exact Bezier'); const s = await shape('star', 'Bezier Star'); await Anim.keyframeCreate(s.layerId, 'position.x', 0, -300); await Anim.keyframeCreate(s.layerId, 'position.x', 60, 300); await Anim.keyframeSetTangents(s.layerId, 'position.x', { frame: 0, angle: 25, weight: 40, angleLocked: false, weightLocked: false }); await Anim.keyframeSetVelocity(s.layerId, 'position.x', { frame: 0, rightSpeed: 1.2, rightInfluence: 0.75 }); },
  },
  {
    slug: '03-parented-hierarchy', description: 'Two shapes parented under an animated group.',
    expected: { nodeTypes: ['group', 'basicShape'], animatedAttributes: ['position.x'], hierarchy: true, minConnections: 1 },
    build: async () => { await base('Hierarchy'); const group = await Layer.layerCreate('group', 'Orbit Group'); const a = await shape('ellipse', 'Left', { x: -120, y: 0 }); const b = await shape('rectangle', 'Right', { x: 120, y: 0 }); await Layer.layerParent(a.layerId, group.layerId); await Layer.layerParent(b.layerId, group.layerId); await Anim.keyframeCreate(group.layerId, 'position.x', 0, -180); await Anim.keyframeCreate(group.layerId, 'position.x', 90, 180); await Anim.keyframeSetInterpolation(group.layerId, 'position.x', 0, 1); },
  },
  {
    slug: '04-word-rise-stagger', description: 'Word-level kinetic typography using Sub-Mesh and Stagger.',
    recipe: 'word-rise-stagger', expected: { nodeTypes: ['textShape', 'subMesh', 'stagger'], animatedAttributes: ['shapePosition.y'], hierarchy: true, minConnections: 3 },
    build: async () => { await base('Word Rise'); const t = await Typo.textCreate({ text: 'WORDS RISE TOGETHER', fontSize: 72, alignment: 'center', name: 'Word Title' }); await Layout.designCenter(t.layerId); const sub = await Layer.layerCreate('subMesh', 'Word Animator'); await Attr.attributeSet(sub.layerId, 'subMeshMode', 1); await Anim.keyframeCreate(sub.layerId, 'shapePosition.y', 5, 50); await Anim.keyframeCreate(sub.layerId, 'shapePosition.y', 33, 0); await connect(sub.layerId, t.layerId, 'deformers'); const stagger = await Layer.layerCreate('stagger', 'Word Stagger'); await Attr.attributeSetMany(stagger.layerId, { minimum: -30, maximum: 0 }); await connect(stagger.layerId, sub.layerId, 'shapeTimeOffset'); await Layer.layerParent(sub.layerId, t.layerId); await Layer.layerParent(stagger.layerId, t.layerId); },
  },
  {
    slug: '05-character-cascade', description: 'Character-level opacity cascade using Sub-Mesh and Stagger.',
    recipe: 'character-cascade', expected: { nodeTypes: ['textShape', 'subMesh', 'stagger'], animatedAttributes: ['shapeOpacity'], hierarchy: true, minConnections: 3 },
    build: async () => { await base('Character Cascade'); const t = await Typo.textCreate({ text: 'CASCADE', fontSize: 96, alignment: 'center', name: 'Cascade Text' }); await Layout.designCenter(t.layerId); const sub = await Layer.layerCreate('subMesh', 'Character Animator'); await Anim.keyframeCreate(sub.layerId, 'shapeOpacity', 5, 0); await Anim.keyframeCreate(sub.layerId, 'shapeOpacity', 35, 100); await connect(sub.layerId, t.layerId, 'deformers'); const stagger = await Layer.layerCreate('stagger', 'Character Stagger'); await Attr.attributeSetMany(stagger.layerId, { minimum: -20, maximum: 0 }); await connect(stagger.layerId, sub.layerId, 'shapeTimeOffset'); await Layer.layerParent(sub.layerId, t.layerId); await Layer.layerParent(stagger.layerId, t.layerId); },
  },
  {
    slug: '06-radial-duplication-wave', description: 'Ellipse source into Duplicator with Circle Distribution and Stagger time offset.',
    recipe: 'radial-duplication-wave', expected: { nodeTypes: ['basicShape', 'duplicator', 'circleDistribution', 'stagger'], animatedAttributes: ['opacity'], minConnections: 5 },
    build: async () => { await base('Radial Wave'); const source = await shape('ellipse', 'Dot'); await Attr.attributeSet(source.layerId, 'scale', { x: 0.22, y: 0.22 }); await Anim.keyframeCreate(source.layerId, 'opacity', 0, 15); await Anim.keyframeCreate(source.layerId, 'opacity', 20, 100); const dup = await Layer.layerCreate('duplicator', 'Radial Duplicator'); await Gen.generatorSet(dup.layerId, 'circleDistribution', 'generator'); await Attr.attributeSetMany(dup.layerId, { 'generator.count': 16, 'generator.radius': 190 }); await connect(source.layerId, dup.layerId, 'shapes'); const stagger = await Layer.layerCreate('stagger', 'Clockwise Stagger'); await Attr.attributeSetMany(stagger.layerId, { minimum: -30, maximum: 0 }); await connect(stagger.layerId, dup.layerId, 'shapeTimeOffset'); },
  },
  {
    slug: '07-grid-duplication-wave', description: 'Rectangle source repeated through Grid Distribution with shared animation.',
    recipe: 'grid-duplication-wave', expected: { nodeTypes: ['basicShape', 'duplicator', 'gridDistribution'], animatedAttributes: ['opacity'], minConnections: 3 },
    build: async () => { await base('Grid Wave'); const source = await shape('rectangle', 'Grid Cell'); await Attr.attributeSet(source.layerId, 'scale', { x: 0.2, y: 0.2 }); await Anim.keyframeCreate(source.layerId, 'opacity', 0, 10); await Anim.keyframeCreate(source.layerId, 'opacity', 45, 100); const dup = await Layer.layerCreate('duplicator', 'Grid Duplicator'); await connect(source.layerId, dup.layerId, 'shapes'); },
  },
  {
    slug: '08-oscillator-driven-rotation', description: 'Oscillator procedurally drives a shape rotation.',
    expected: { nodeTypes: ['basicShape', 'oscillator'], minConnections: 2 },
    build: async () => { await base('Oscillator Rotation'); const s = await shape('star', 'Oscillating Star'); const osc = await Layer.layerCreate('oscillator', 'Rotation Oscillator'); await connect(osc.layerId, s.layerId, 'rotation'); },
  },
  {
    slug: '09-falloff-value-control', description: 'Falloff drives a Value utility which controls shape opacity.',
    expected: { nodeTypes: ['basicShape', 'falloff', 'value'], minConnections: 3 },
    build: async () => { await base('Falloff Value'); const s = await shape('ellipse', 'Falloff Target'); const value = await Layer.layerCreate('value', 'Opacity Value'); await Attr.attributeSet(value.layerId, 'value', 100); const falloff = await Layer.layerCreate('falloff', 'Spatial Falloff'); await Attr.attributeSet(falloff.layerId, 'size', { x: 600, y: 600 }); await connect(falloff.layerId, value.layerId, 'falloffs'); await connect(value.layerId, s.layerId, 'opacity'); },
  },
  {
    slug: '10-blur-filter-graph', description: 'Blur Filter connected to a moving shape.',
    expected: { nodeTypes: ['basicShape', 'blurFilter'], animatedAttributes: ['position.x'], minConnections: 3 },
    build: async () => { await base('Blur Filter'); const s = await shape('ellipse', 'Blurred Circle'); const blur = await Layer.layerCreate('blurFilter', 'Motion Blur Amount'); await Attr.attributeSet(blur.layerId, 'amount', 28); await connect(blur.layerId, s.layerId, 'filters'); await Anim.keyframeCreate(s.layerId, 'position.x', 0, -250); await Anim.keyframeCreate(s.layerId, 'position.x', 60, 250); },
  },
  {
    slug: '11-point-constraint', description: 'Point Constraint drives a follower position from a target shape.',
    expected: { nodeTypes: ['basicShape', 'pointConstraint'], minConnections: 3 },
    build: async () => { await base('Point Constraint'); const target = await shape('ellipse', 'Constraint Target', { x: -160, y: 0 }); const follower = await shape('star', 'Follower'); const constraint = await Layer.layerCreate('pointConstraint', 'Point Constraint'); await connect(target.layerId, constraint.layerId, 'target'); await connect(constraint.layerId, follower.layerId, 'position', 'out'); },
  },
  {
    slug: '12-precomposition', description: 'Two shapes precomposed and referenced into the main composition.',
    expected: { nodeTypes: ['compNode'], minConnections: 1 },
    build: async () => { await base('Precomposition'); const a = await shape('ellipse', 'Precomp Circle', { x: -80, y: 0 }); const b = await shape('rectangle', 'Precomp Square', { x: 80, y: 0 }); await Comp.compositionPrecompose([a.layerId, b.layerId], 'Golden Precomp'); },
  },
  {
    slug: '13-marker-timing', description: 'Composition timing structure with labelled markers and animated text.',
    expected: { nodeTypes: ['textShape', 'timeMarker'], animatedAttributes: ['opacity'], minConnections: 3 },
    build: async () => { await base('Marker Timing', 120); const t = await Typo.textCreate({ text: 'TIMING', fontSize: 90, alignment: 'center', name: 'Timing Title' }); await Layout.designCenter(t.layerId); await Anim.keyframeCreate(t.layerId, 'opacity', 10, 0); await Anim.keyframeCreate(t.layerId, 'opacity', 30, 100); await Marker.markerCreate(0, 'Start', '#ffffff'); await Marker.markerCreate(10, 'Entrance', '#ffaa00'); await Marker.markerCreate(90, 'Exit', '#ff0055'); },
  },
  {
    slug: '14-editable-svg-path', description: 'SVG converted to native editable shape and animated.',
    expected: { nodeTypes: ['editableShape'], animatedAttributes: ['position.x'], minConnections: 1 },
    build: async () => { await base('Editable Path'); const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect x="40" y="40" width="220" height="220" fill="#00d4ff"/></svg>'; const corpusSvg = resolve(ROOT, 'editable-source.svg'); const importSvg = resolve(tmpdir(), 'cavalry-golden-editable.svg'); await writeFile(corpusSvg, svgContent); await writeFile(importSvg, svgContent); const converted = await Path.svgConvertToLayers(importSvg); const layers = await Layer.layerList(false); const editable = layers.layers.find((item) => item.type === 'editableShape') ?? layers.layers.at(-1); assert.ok(editable); await Anim.keyframeCreate(editable.layerId, 'position.x', 0, -180); await Anim.keyframeCreate(editable.layerId, 'position.x', 60, 180); assert.ok(converted.layerCount >= 1); },
  },
  {
    slug: '15-svg-asset-footage', description: 'Imported SVG asset added to the active composition.',
    expected: { nodeTypes: ['asset', 'svgShape'], minConnections: 1 },
    build: async () => { await base('SVG Asset'); const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="120" fill="#ff3366"/></svg>'; const corpusSvg = resolve(ROOT, 'asset-source.svg'); const importSvg = resolve(tmpdir(), 'cavalry-golden-asset.svg'); await writeFile(corpusSvg, svgContent); await writeFile(importSvg, svgContent); const asset = await Asset.assetImport(importSvg, false); await Asset.assetAddToComposition(asset.assetId); },
  },
  {
    slug: '16-multi-composition-reference', description: 'Second composition referenced into the active composition.',
    expected: { nodeTypes: ['compNode'], minConnections: 1 },
    build: async () => { const main = await base('Main Composition'); const child = await Comp.compositionCreate({ name: 'Child Composition', width: 480, height: 270, fps: 30, startFrame: 0, endFrame: 60 }); await shape('star', 'Child Star'); await Comp.compositionSetActive((main as any).compId ?? (main as any).layerId); await Comp.compositionCreateReference((child as any).compId ?? (child as any).layerId); },
  },
  {
    slug: '17-camera-scene', description: 'Native planar camera with foreground and background shapes.',
    expected: { nodeTypes: ['planarCamera', 'basicShape'], minConnections: 1 },
    build: async () => { await base('Camera Scene'); await shape('rectangle', 'Background', { x: 0, y: 0 }); await shape('star', 'Foreground', { x: 100, y: -60 }); await Parity.parityCall('camera_create', { name: 'Golden Camera', cameraType: 0 }); },
  },
  {
    slug: '18-repeated-data-cards', description: 'Reusable card-like group repeated in a grid.',
    recipe: 'repeated-data-cards', expected: { nodeTypes: ['group', 'basicShape', 'textShape', 'duplicator', 'gridDistribution'], animatedAttributes: ['opacity'], hierarchy: true, minConnections: 6 },
    build: async () => { await base('Repeated Cards'); const card = await Layer.layerCreate('group', 'Data Card'); const bg = await shape('rectangle', 'Card Background'); await Attr.attributeSet(bg.layerId, 'scale', { x: 0.28, y: 0.14 }); await Anim.keyframeCreate(bg.layerId, 'opacity', 0, 0); await Anim.keyframeCreate(bg.layerId, 'opacity', 30, 100); const label = await Typo.textCreate({ text: '42', fontSize: 54, alignment: 'center', name: 'Card Value' }); await Layer.layerParent(bg.layerId, card.layerId); await Layer.layerParent(label.layerId, card.layerId); const dup = await Layer.layerCreate('duplicator', 'Card Grid'); await Gen.generatorSet(dup.layerId, 'gridDistribution', 'generator'); await Attr.attributeSetMany(dup.layerId, { 'generator.count': { x: 3, y: 3 }, 'generator.size': { x: 620, y: 300 } }); await connect(bg.layerId, dup.layerId, 'shapes'); },
  },
  {
    slug: '19-directional-wipe', description: 'Directional wipe-style transition using a full-frame moving shape.',
    recipe: 'directional-wipe-transition', expected: { nodeTypes: ['basicShape', 'textShape'], animatedAttributes: ['position.x'], minConnections: 2 },
    build: async () => { await base('Directional Wipe'); const title = await Typo.textCreate({ text: 'REVEAL', fontSize: 96, alignment: 'center', name: 'Reveal Title' }); await Layout.designCenter(title.layerId); const wipe = await shape('rectangle', 'Wipe Matte'); await Attr.attributeSet(wipe.layerId, 'scale', { x: 5, y: 3 }); await Anim.keyframeCreate(wipe.layerId, 'position.x', 0, -960); await Anim.keyframeCreate(wipe.layerId, 'position.x', 45, 960); },
  },
  {
    slug: '20-logo-geometric-assembly', description: 'Geometric logo parts assembled under one animated parent.',
    recipe: 'logo-geometric-assembly', expected: { nodeTypes: ['group', 'basicShape'], animatedAttributes: ['position.y', 'opacity'], hierarchy: true, minConnections: 2 },
    build: async () => { await base('Logo Assembly'); const logo = await Layer.layerCreate('group', 'Logo'); const a = await shape('polygon', 'Logo A', { x: -70, y: 0 }); const b = await shape('polygon', 'Logo B', { x: 70, y: 0 }); await Layer.layerParent(a.layerId, logo.layerId); await Layer.layerParent(b.layerId, logo.layerId); await Anim.keyframeCreate(logo.layerId, 'position.y', 0, 160); await Anim.keyframeCreate(logo.layerId, 'position.y', 35, 0); await Anim.keyframeCreate(logo.layerId, 'opacity', 0, 0); await Anim.keyframeCreate(logo.layerId, 'opacity', 20, 100); },
  },
  {
    slug: '21-progress-indicator', description: 'One normalized animation drives a progress bar and counter label.',
    recipe: 'progress-indicator', expected: { nodeTypes: ['basicShape', 'textShape'], animatedAttributes: ['scale.x'], minConnections: 1 },
    build: async () => { await base('Progress Indicator'); const bar = await shape('rectangle', 'Progress Bar', { x: -240, y: 0 }); await Attr.attributeSet(bar.layerId, 'pivot', { x: -50, y: 0 }); await Anim.keyframeCreate(bar.layerId, 'scale.x', 0, 0); await Anim.keyframeCreate(bar.layerId, 'scale.x', 60, 4.8); const label = await Typo.textCreate({ text: '100%', fontSize: 52, alignment: 'center', name: 'Progress Label' }); await Attr.attributeSet(label.layerId, 'position', { x: 330, y: 0 }); },
  },
  {
    slug: '22-mask-line-reveal', description: 'Text revealed by an animated rectangular mask input.',
    recipe: 'mask-line-reveal', expected: { nodeTypes: ['textShape', 'basicShape'], animatedAttributes: ['position.x'], minConnections: 3 },
    build: async () => { await base('Mask Line Reveal'); const text = await Typo.textCreate({ text: 'MASK REVEAL', fontSize: 82, alignment: 'center', name: 'Masked Title' }); await Layout.designCenter(text.layerId); const mask = await shape('rectangle', 'Reveal Mask'); await Attr.attributeSet(mask.layerId, 'scale', { x: 2.6, y: 0.9 }); await connect(mask.layerId, text.layerId, 'masks'); await Anim.keyframeCreate(mask.layerId, 'position.x', 0, -500); await Anim.keyframeCreate(mask.layerId, 'position.x', 45, 0); },
  },
  {
    slug: '23-orbit-loop', description: 'Parented satellite follows a closed five-key orbit with a matching first and last sample.',
    recipe: 'orbit-loop', expected: { nodeTypes: ['group', 'basicShape'], animatedAttributes: ['position.x', 'position.y'], hierarchy: true, minConnections: 8 },
    build: async () => { await base('Orbit Loop'); const orbit = await Layer.layerCreate('group', 'Orbit Rig'); const satellite = await shape('ellipse', 'Satellite', { x: 170, y: 0 }); await Attr.attributeSet(satellite.layerId, 'scale', { x: 0.35, y: 0.35 }); await Layer.layerParent(satellite.layerId, orbit.layerId); for (const [frame, x, y] of [[0, 170, 0], [15, 0, 170], [30, -170, 0], [45, 0, -170], [60, 170, 0]] as const) { await Anim.keyframeCreate(satellite.layerId, 'position.x', frame, x); await Anim.keyframeCreate(satellite.layerId, 'position.y', frame, y); } },
  },
  {
    slug: '24-procedural-burst', description: 'Thin rectangular ray repeated around a Circle Distribution and animated as one source.',
    recipe: 'procedural-burst', expected: { nodeTypes: ['basicShape', 'duplicator', 'circleDistribution'], animatedAttributes: ['scale.y', 'opacity'], minConnections: 6 },
    build: async () => { await base('Procedural Burst'); const ray = await shape('rectangle', 'Burst Ray', { x: 0, y: -120 }); await Attr.attributeSet(ray.layerId, 'scale', { x: 0.08, y: 0.8 }); await Anim.keyframeCreate(ray.layerId, 'scale.y', 0, 0); await Anim.keyframeCreate(ray.layerId, 'scale.y', 25, 1.2); await Anim.keyframeCreate(ray.layerId, 'scale.y', 45, 0.8); await Anim.keyframeCreate(ray.layerId, 'opacity', 0, 0); await Anim.keyframeCreate(ray.layerId, 'opacity', 20, 100); await Anim.keyframeCreate(ray.layerId, 'opacity', 60, 0); const dup = await Layer.layerCreate('duplicator', 'Burst Duplicator'); await Gen.generatorSet(dup.layerId, 'circleDistribution', 'generator'); await Attr.attributeSetMany(dup.layerId, { 'generator.count': 18, 'generator.radius': 120 }); await connect(ray.layerId, dup.layerId, 'shapes'); },
  },
];

function valueOf(attribute: any): unknown {
  if (!attribute || typeof attribute !== 'object') return attribute;
  if ('value' in attribute) return attribute.value;
  return attribute;
}

function extractInspection(snapshotState: string, live: any, composition: any, description: string) {
  const snapshot = JSON.parse(snapshotState);
  const nodes: any[] = snapshot.nodes ?? [];
  const connections: any[] = snapshot.connections ?? [];
  const typeById = new Map(nodes.map((node) => [node.nodeId, node.nodeType]));
  const parentByChild = new Map<string, string>();
  for (const meta of snapshot.nodeMeta ?? []) for (const child of meta.children ?? []) parentByChild.set(child, meta.nodeId);
  const layers = nodes.map((node) => {
    const inbound = connections.filter((connection) => connection.to.startsWith(`${node.nodeId}.`));
    const animatedAttributes = inbound.filter((connection) => /Curve#/.test(connection.from) || /curve#/.test(connection.from)).map((connection) => connection.to.slice(node.nodeId.length + 1));
    const generatorTypes = inbound.filter((connection) => connection.to.endsWith('.generator')).map((connection) => typeById.get(connection.from.split('.')[0])).filter(Boolean);
    return {
      id: node.nodeId,
      layerId: node.nodeId,
      type: node.nodeType,
      name: valueOf(node.attributes?.niceName) ?? node.nodeId,
      parentId: parentByChild.get(node.nodeId),
      attributes: node.attributes ?? {},
      animatedAttributes,
      generatorTypes,
    };
  });
  return {
    composition: {
      width: composition.resolution?.x,
      height: composition.resolution?.y,
      fps: composition.fps,
      startFrame: composition.frameRange?.x,
      endFrame: composition.frameRange?.y,
    },
    layers,
    connections: connections.map((connection) => {
      const [fromLayerId, ...from] = connection.from.split('.');
      const [toLayerId, ...to] = connection.to.split('.');
      return { fromLayerId, fromAttribute: from.join('.'), toLayerId, toAttribute: to.join('.') };
    }),
    hierarchy: [...parentByChild.entries()].map(([child, parent]) => ({ parent, child })),
    markers: live.markers ?? [],
    assets: live.assets ?? [],
    summary: description,
    rawSnapshot: snapshot,
  };
}

function validate(spec: GoldenScene, inspection: any, previewPath: string, scenePath: string) {
  assert.equal(inspection.composition.width, 960);
  assert.equal(inspection.composition.height, 540);
  assert.equal(inspection.composition.fps, 30);
  const types = new Set(inspection.layers.map((layer: any) => layer.type));
  for (const type of spec.expected.nodeTypes) assert.ok(types.has(type), `${spec.slug}: missing node type ${type}`);
  assert.ok(inspection.connections.length >= (spec.expected.minConnections ?? 0), `${spec.slug}: too few graph connections`);
  const animated = new Set(inspection.layers.flatMap((layer: any) => layer.animatedAttributes));
  for (const attribute of spec.expected.animatedAttributes ?? []) assert.ok(animated.has(attribute), `${spec.slug}: missing animated attribute ${attribute}`);
  if (spec.expected.hierarchy) assert.ok(inspection.hierarchy.length > 0, `${spec.slug}: missing hierarchy`);
  return Promise.all([stat(previewPath).then((info) => assert.ok(info.size > 0)), stat(scenePath).then((info) => assert.ok(info.size > 0))]);
}

async function run(spec: GoldenScene) {
  const directory = resolve(ROOT, spec.slug);
  await mkdir(directory, { recursive: true });
  await spec.build();
  const scenePath = resolve(directory, `${spec.slug}.cv`);
  const previewPath = resolve(directory, `${spec.slug}.png`);
  await Scene.sceneSaveAs(scenePath);
  await Anim.timelineSetFrame(30);
  await Preview.previewFrame(30, 50, previewPath);
  const [live, composition, snapshot] = await Promise.all([Scene.sceneInspect(true), Comp.compositionGetActive(), Scene.sceneSnapshot()]);
  const inspection = extractInspection(snapshot.state, live, composition, spec.description);
  await validate(spec, inspection, previewPath, scenePath);
  const inspectionPath = resolve(directory, `${spec.slug}.inspection.json`);
  await writeFile(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`);
  const ingestion = await knowledgeEngine.ingestion.ingestSceneInspection(spec.slug, inspection, {
    scope: 'project', projectId: PROJECT_ID, cavalryVersion: '2.7.2', verified: true, filePath: scenePath,
  });
  const manifest = { slug: spec.slug, description: spec.description, recipe: spec.recipe, verified: true, scenePath, previewPath, inspectionPath, nodeCount: inspection.layers.length, connectionCount: inspection.connections.length, animatedAttributes: [...new Set(inspection.layers.flatMap((layer: any) => layer.animatedAttributes))], ingestion };
  await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  const indexArg = process.argv.find((arg) => arg.startsWith('--index='));
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  const spec = indexArg ? scenes[Number(indexArg.split('=')[1]) - 1] : slugArg ? scenes.find((item) => item.slug === slugArg.split('=')[1]) : undefined;
  if (!spec) {
    process.stdout.write(`${JSON.stringify(scenes.map((item, index) => ({ index: index + 1, slug: item.slug, recipe: item.recipe })), null, 2)}\n`);
    return;
  }
  try {
    const result = await run(spec);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await knowledgeEngine.addFailure({ intent: `Build and verify golden scene ${spec.slug}`, approach: 'Structured MCP scene build, snapshot extraction, preview render, and validation', mcpOperation: 'golden_corpus_build', error: message, category: 'LIVE_CORPUS_VALIDATION', solution: 'Pending investigation; do not ingest the failed scene.' }, 'project', PROJECT_ID, '2.7.2');
    } catch {}
    throw error;
  } finally {
    bridgeClient.stopCallbackServer();
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; });
