/**
 * A behavioural model of the parts of Cavalry's scripting host that matter for
 * attribute hygiene. It is not Cavalry: it reproduces the observed contract —
 *   - api.get on an attribute the node does not have logs
 *     "Attribute not found: <id>.<path>" and throws (even if caught);
 *   - api.getAttributes / api.hasAttribute answer without logging;
 *   - change notifications fire for every object, including animation curves
 *     and time markers, and for non-value paths (out, time, keyframes.N, and
 *     configuration-dependent children such as gradient/stroke/matte/taper).
 * Counts measured against it are model counts, not live host measurements.
 */
export interface HostLog {
  attributeNotFound: number;
  byFamily: Map<string, number>;
  otherErrors: number;
}

const COMMON = ['uuid', 'position', 'scale', 'rotation', 'opacity', 'hidden', 'material', 'material.materialColor', 'stroke', 'pivot'];
const TYPES: Record<string, string[]> = {
  textShape: [...COMMON, 'text', 'font', 'fontSize', 'horizontalAlignment', 'verticalAlignment', 'letterSpacing', 'lineSpacing', 'autoWidth'],
  basicShape: [...COMMON, 'generator', 'generator.dimensions', 'generator.cornerRadius'],
  group: ['uuid', 'position', 'scale', 'rotation', 'opacity', 'hidden'],
  compNode: ['uuid', 'resolution', 'fps', 'startFrame', 'endFrame', 'defaultCompBackground', 'motionBlur'],
  timeMarker: ['time', 'label', 'color'],
  animationCurve: ['preInfinity', 'postInfinity'],
  renderQueueItem: ['filePath', 'fileName', 'frameRange', 'frameRangeMode', 'metadata'],
};
// Paths Cavalry notifies on a shape even though they are not readable values
// in the shape's current configuration (families seen in the production log).
const PSEUDO_NOTIFICATIONS = ['out', 'time', 'keyframes.0', 'gradient.0', 'gradient.0.color', 'stroke.width', 'matte.enabled', 'taper.start', 'animationLayer.weight', 'rig.control'];

function rootOf(path: string): string {
  return path.split('.')[0];
}

export interface CavalryModel {
  api: Record<string, any>;
  log: HostLog;
  setCallbacks(callbacks: Record<string, (...args: any[]) => unknown>): void;
  typeOf(id: string): string;
}

export function createCavalryModel(): CavalryModel {
  const log: HostLog = { attributeNotFound: 0, byFamily: new Map(), otherErrors: 0 };
  const types = new Map<string, string>();
  const values = new Map<string, Map<string, unknown>>();
  const keyframes = new Map<string, number[]>();
  const curves = new Map<string, string>();
  const parents = new Map<string, string>();
  const markers: string[] = [];
  let counter = 0;
  let activeComp = '';
  let callbacks: Record<string, (...args: any[]) => unknown> = {};
  const notify = (name: string, ...args: unknown[]) => { try { callbacks[name]?.(...args); } catch { log.otherErrors += 1; } };

  const known = (id: string, path: string) => {
    const attributes = TYPES[types.get(id) ?? ''] ?? [];
    if (attributes.includes(path)) return true;
    if (/^material\.materialColor\.[rgba]$/.test(path)) return attributes.includes('material.materialColor');
    return attributes.includes(rootOf(path)) && /^(position|scale|rotation|pivot|material|generator)\./.test(`${rootOf(path)}.`) && path.split('.').length === 2;
  };
  const notFound = (id: string, path: string) => {
    log.attributeNotFound += 1;
    const family = `${(types.get(id) ?? 'unknown')}.${path.replace(/\.\d+/g, '.N')}`;
    log.byFamily.set(family, (log.byFamily.get(family) ?? 0) + 1);
    throw new Error(`Attribute not found: ${id}.${path}`);
  };
  const create = (type: string) => {
    counter += 1;
    const id = `${type}#${counter}`;
    types.set(id, type);
    values.set(id, new Map([['uuid', `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`]]));
    return id;
  };
  const initialise = (id: string) => {
    notify('onLayerAdded', id);
    for (const attribute of TYPES[types.get(id)!] ?? []) notify('onAttrChanged', id, attribute);
    for (const path of PSEUDO_NOTIFICATIONS) notify('onAttrChanged', id, path);
  };
  const channelCurve = (id: string, path: string) => {
    const key = `${id}\u0000${path}`;
    let curve = curves.get(key);
    if (!curve) {
      curve = create('animationCurve');
      values.get(curve)!.delete('uuid');
      curves.set(key, curve);
      notify('onLayerAdded', curve);
    }
    return curve;
  };

  const api: Record<string, any> = {
    getCavalryVersion: () => '2.7.2',
    getLayerType: (id: string) => types.get(id) ?? '',
    getAttributes: (id: string) => [...(TYPES[types.get(id) ?? ''] ?? [])],
    hasAttribute: (id: string, path: string) => known(id, path),
    getNiceName: (id: string) => String(values.get(id)?.get('__name') ?? id),
    get(id: string, path: string) {
      if (!types.has(id) || !known(id, path)) return notFound(id, path);
      return values.get(id)!.get(path) ?? 0;
    },
    set(id: string, updates: Record<string, unknown>) {
      for (const [path, value] of Object.entries(updates)) {
        if (!known(id, path)) notFound(id, path);
        values.get(id)!.set(path, value);
        notify('onAttrChanged', id, path);
      }
      notify('onAttrChanged', id, 'out');
    },
    create(type: string, name: string) { const id = create(type); values.get(id)!.set('__name', name); initialise(id); return id; },
    primitive(_kind: string, name: string) { const id = create('basicShape'); values.get(id)!.set('__name', name); initialise(id); return id; },
    createComp(name: string) { const id = create('compNode'); values.get(id)!.set('__name', name); notify('onLayerAdded', id); return id; },
    setActiveComp(id: string) { activeComp = id; },
    getActiveComp: () => activeComp,
    newScene() { types.clear(); values.clear(); keyframes.clear(); curves.clear(); parents.clear(); markers.length = 0; activeComp = ''; notify('onSceneChanged'); },
    keyframe(id: string, frame: number, updates: Record<string, unknown>) {
      for (const [path, value] of Object.entries(updates)) {
        if (!known(id, path)) notFound(id, path);
        const key = `${id}\u0000${path}`;
        const frames = keyframes.get(key) ?? [];
        frames.push(frame);
        keyframes.set(key, frames);
        values.get(id)!.set(path, value);
        const curve = channelCurve(id, path);
        notify('onAttrChanged', curve, `keyframes.${frames.length - 1}`);
        notify('onAttrChanged', curve, 'keyframes');
        notify('onAttrChanged', id, path);
        notify('onAttrChanged', id, 'out');
        notify('onAttrChanged', id, 'time');
      }
    },
    getKeyframeTimes: (id: string, path: string) => keyframes.get(`${id}\u0000${path}`) ?? [],
    magicEasing(id: string, path: string) { const curve = channelCurve(id, path); notify('onAttrChanged', curve, 'keyframes.0'); notify('onAttrChanged', id, 'out'); },
    modifyKeyframe(id: string, updates: Record<string, unknown>) { for (const path of Object.keys(updates)) notify('onAttrChanged', channelCurve(id, path), 'keyframes.0'); },
    getEffectiveAttributeDefinition: () => ({ type: 'double' }),
    createTimeMarker() { const id = create('timeMarker'); values.get(id)!.delete('uuid'); markers.push(id); notify('onLayerAdded', id); return id; },
    getTimeMarkers: () => [...markers],
    parent(child: string, parent: string) { parents.set(child, parent); notify('onAttrChanged', child, 'out'); },
    unParent(child: string) { parents.delete(child); },
    getParent: (id: string) => parents.get(id) ?? '',
    getChildren: (id: string) => [...parents.entries()].filter(([, parent]) => parent === id).map(([child]) => child),
    reorder() {},
    select() {},
    getSelection: () => [],
    deleteLayer(id: string) { types.delete(id); values.delete(id); notify('onLayerRemoved', id); },
    getAllSceneLayers: () => [...types.entries()].filter(([, type]) => !['animationCurve', 'timeMarker', 'renderQueueItem'].includes(type)).map(([id]) => id),
    getAssetWindowLayers: () => [],
    getInConnectedAttributes: () => [],
    getOutConnectedAttributes: () => [],
    getSceneFilePath: () => '',
    sceneHasUnsavedChanges: () => true,
    getFrame: () => 0,
    processEvents() {},
    getLayerFromUUID(uuid: string) { for (const [id, attributes] of values) if (attributes.get('uuid') === uuid) return id; return ''; },
    getCurrentGeneratorType: () => 'rectangle',
    addRenderQueueItem() { const id = create('renderQueueItem'); values.get(id)!.delete('uuid'); notify('onLayerAdded', id); return id; },
    getRenderQueueItems: () => [...types.entries()].filter(([, type]) => type === 'renderQueueItem').map(([id]) => id),
    setGenerator() {},
  };
  return {
    api,
    log,
    setCallbacks(value) { callbacks = value; },
    typeOf: (id) => types.get(id) ?? '',
  };
}
