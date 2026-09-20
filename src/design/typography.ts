import { layerCreate, layerBoundingBox } from '../cavalry/layers.js';
import { attributeSet, attributeSetMany, attributeGet } from '../cavalry/attributes.js';
import { executeBatch } from '../cavalry/capabilities.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CavalryError } from '../mcp/errors.js';
import { identityResolver } from '../utils/ids.js';

const execFileAsync = promisify(execFile);

export interface TextCreateParams {
  text: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  tracking?: number;
  lineSpacing?: number;
  name?: string;
}

export async function textCreate(params: TextCreateParams) {
  // Give unnamed text layers a stable, searchable name so they can be
  // resolved after save/reopen even when Cavalry does not expose text content
  // through layer identity metadata.
  const layer = await layerCreate('textShape', params.name || params.text || 'Text');
  const updates: Record<string, unknown> = {};

  if (params.fontSize !== undefined) updates.fontSize = params.fontSize;
  if (params.fontFamily) {
    updates.font = {
      font: params.fontFamily,
      style: params.fontStyle || 'Regular',
    };
  }
  if (params.color) {
    updates['material.materialColor'] = params.color;
  }
  if (params.alignment) {
    // 0 = left, 1 = centre, 2 = right
    const alignMap = { left: 0, center: 1, right: 2 };
    updates.horizontalAlignment = alignMap[params.alignment] ?? 1;
  }
  if (params.tracking !== undefined) updates.tracking = params.tracking;
  if (params.lineSpacing !== undefined) updates.lineSpacing = params.lineSpacing;

  await attributeSetMany(layer.layerId, updates);
  await attributeSet(layer.layerId, 'text', { text: params.text, overrides: [] });
  return {
    ...layer,
    ...updates,
    text: params.text,
  };
}

export async function textSetContent(layerId: string, text: string) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  return attributeSet(resolved, 'text', { text, overrides: [] });
}

export async function textSetFont(layerId: string, fontFamily: string, fontStyle: string = 'Regular') {
  const resolved = identityResolver.resolveToLayerId(layerId);
  return attributeSet(resolved, 'font', { font: fontFamily, style: fontStyle });
}

export async function textSetFontSize(layerId: string, fontSize: number) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  return attributeSet(resolved, 'fontSize', fontSize);
}

export async function textAnimateCharacters(layerId: string, startFrame: number, duration: number = 30, staggerFrames: number = 2) {
  const target = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;

  return executeBatch({
    operations: [
      {
        id: 'submesh',
        op: 'layer_create',
        params: { layerType: 'subMesh', name: 'Char Animator' },
        saveAs: '$submesh',
      },
      {
        id: 'kf1',
        op: 'keyframe_create',
        params: { layerId: '$submesh', attrPath: 'shapeOpacity', frame: startFrame, value: 0 },
      },
      {
        id: 'kf2',
        op: 'keyframe_create',
        params: { layerId: '$submesh', attrPath: 'shapeOpacity', frame: endFrame, value: 100 },
      },
      {
        id: 'ease',
        op: 'keyframe_magic_easing',
        params: { layerId: '$submesh', attrPath: 'shapeOpacity', frame: startFrame, easingType: 'SlowOut' },
      },
      {
        id: 'conn1',
        op: 'graph_connect',
        params: { sourceLayerId: '$submesh', sourceAttr: 'id', targetLayerId: target, targetAttr: 'deformers', force: true },
      },
      {
        id: 'stagger',
        op: 'layer_create',
        params: { layerType: 'stagger', name: 'Char Stagger' },
        saveAs: '$stagger',
      },
      {
        id: 'set_stagger',
        op: 'attribute_set',
        params: { layerId: '$stagger', attributes: { minimum: -staggerFrames * 10, maximum: 0 } },
      },
      {
        id: 'conn2',
        op: 'graph_connect',
        params: { sourceLayerId: '$stagger', sourceAttr: 'id', targetLayerId: '$submesh', targetAttr: 'shapeTimeOffset', force: true },
      },
      {
        id: 'parent1',
        op: 'layer_parent',
        params: { childLayerId: '$submesh', parentLayerId: target },
      },
      {
        id: 'parent2',
        op: 'layer_parent',
        params: { childLayerId: '$stagger', parentLayerId: target },
      },
    ],
  });
}

export async function textAnimateWords(layerId: string, startFrame: number, duration: number = 30, staggerFrames: number = 4) {
  const target = identityResolver.resolveToLayerId(layerId);
  const endFrame = startFrame + duration;

  return executeBatch({
    operations: [
      {
        id: 'submesh',
        op: 'layer_create',
        params: { layerType: 'subMesh', name: 'Word Animator' },
        saveAs: '$submesh',
      },
      {
        id: 'mode',
        op: 'attribute_set',
        params: { layerId: '$submesh', attributes: { subMeshMode: 1 } }, // Mode 1 = words
      },
      {
        id: 'kf1',
        op: 'keyframe_create',
        params: { layerId: '$submesh', attrPath: 'shapePosition.y', frame: startFrame, value: 50 },
      },
      {
        id: 'kf2',
        op: 'keyframe_create',
        params: { layerId: '$submesh', attrPath: 'shapePosition.y', frame: endFrame, value: 0 },
      },
      {
        id: 'ease',
        op: 'keyframe_magic_easing',
        params: { layerId: '$submesh', attrPath: 'shapePosition.y', frame: startFrame, easingType: 'SlowOut' },
      },
      {
        id: 'conn1',
        op: 'graph_connect',
        params: { sourceLayerId: '$submesh', sourceAttr: 'id', targetLayerId: target, targetAttr: 'deformers', force: true },
      },
      {
        id: 'parent1',
        op: 'layer_parent',
        params: { childLayerId: '$submesh', parentLayerId: target },
      },
    ],
  });
}

export async function listInstalledFonts(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('fc-list', [':', 'family']);
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const unique = Array.from(new Set(lines)).sort();
    if (unique.length) return unique;
  } catch {}

  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPFontsDataType', '-detailLevel', 'mini']);
    const matches = stdout.match(/Family:\s*(.+)/g);
    if (matches) {
      const families = matches.map(m => m.replace(/Family:\s*/, '').trim());
      return Array.from(new Set(families)).sort();
    }
  } catch {}

  return ['Arial', 'Helvetica', 'Inter', 'Times New Roman', 'Courier New', 'System Font'];
}

export async function checkFontExists(fontFamily: string): Promise<boolean> {
  const fonts = await listInstalledFonts();
  return fonts.some(f => f.toLowerCase() === fontFamily.toLowerCase());
}
