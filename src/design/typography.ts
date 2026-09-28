import { layerCreate, layerBoundingBox } from '../cavalry/layers.js';
import { attributeSet, attributeSetMany, attributeGet } from '../cavalry/attributes.js';
import { executeBatch } from '../cavalry/capabilities.js';
import { CavalryError } from '../mcp/errors.js';
import { identityResolver } from '../utils/ids.js';
import { bridgeClient } from '../bridge/client.js';

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
  if (params.fontFamily) await assertFontAvailable(params.fontFamily, params.fontStyle || 'Regular');
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
  // Cavalry 2.7+ exposes typographic tracking as `letterSpacing`.
  if (params.tracking !== undefined) updates.letterSpacing = params.tracking;
  if (params.lineSpacing !== undefined) updates.lineSpacing = params.lineSpacing;

  await attributeSetMany(layer.layerId, updates);
  await attributeSet(layer.layerId, 'text', { text: params.text, overrides: [] });
  const calibration = await layerBoundingBox(layer.layerId, false);
  return {
    ...layer,
    ...updates,
    text: params.text,
    typographyCalibration: {
      boundingBox: calibration.boundingBox,
      alignment: params.alignment ?? 'center',
      coordinateSpace: 'layer-local',
      pivotCorrectionApplied: false,
    },
  };
}

export async function textSetContent(layerId: string, text: string) {
  const resolved = identityResolver.resolveToLayerId(layerId);
  return attributeSet(resolved, 'text', { text, overrides: [] });
}

export async function textSetFont(layerId: string, fontFamily: string, fontStyle: string = 'Regular') {
  await assertFontAvailable(fontFamily, fontStyle);
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
  const response = await bridgeClient.send<{ fonts: string[] }>('font_list');
  return response.result?.fonts ?? [];
}

export async function checkFontExists(fontFamily: string, fontStyle = 'Regular'): Promise<Record<string, unknown>> {
  const response = await bridgeClient.send<Record<string, unknown>>('font_check', { fontFamily, fontStyle });
  return response.result!;
}

async function assertFontAvailable(fontFamily: string, fontStyle: string): Promise<void> {
  const result = await checkFontExists(fontFamily, fontStyle);
  if (!result.available) {
    throw new CavalryError({
      code: 'FONT_RESTART_REQUIRED',
      message: String(result.message),
      operation: 'text_set_font',
      suggestion: 'Install the requested font if needed, restart Cavalry, and retry.',
    });
  }
}
