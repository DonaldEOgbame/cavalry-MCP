import { contentHash } from './provenance.js';
import { GraphEdge, GraphFingerprint, GraphNode, SceneGraph, SceneKnowledge } from './types.js';

const clean = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const sortedUnique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort();

function edgeEndpoint(raw: unknown, keys: string[]): string {
  if (!raw || typeof raw !== 'object') return '';
  const object = raw as Record<string, unknown>;
  for (const key of keys) if (object[key] !== undefined) return clean(object[key]);
  return '';
}

export function normalizeSceneGraph(input: SceneGraph): SceneGraph {
  const byOriginalKey = new Map<string, GraphNode>();
  for (const node of input.nodes) byOriginalKey.set(clean(node.key), node);
  const typeFor = (key: string): string => clean(byOriginalKey.get(clean(key))?.type || 'unknown');

  const nodes = input.nodes.map((node, index) => ({
    ...node,
    key: `n${index}`,
    type: clean(node.type),
    superTypes: sortedUnique((node.superTypes ?? []).map(clean)),
    generatorTypes: sortedUnique((node.generatorTypes ?? []).map(clean)),
    animatedAttributes: sortedUnique((node.animatedAttributes ?? []).map(clean)),
    role: node.role ? clean(node.role) : undefined,
  }));

  const edges = input.edges.map((edge) => ({
    ...edge,
    from: typeFor(edge.from),
    to: typeFor(edge.to),
    fromAttribute: edge.fromAttribute ? clean(edge.fromAttribute) : undefined,
    toAttribute: edge.toAttribute ? clean(edge.toAttribute) : undefined,
    kind: edge.kind ?? 'connection',
  }));
  const graph = { nodes, edges };
  return { ...graph, fingerprint: fingerprintGraph(graph) };
}

export function fingerprintGraph(graph: Pick<SceneGraph, 'nodes' | 'edges'>): GraphFingerprint {
  const originalTypes = new Map(graph.nodes.map((node) => [clean(node.key), clean(node.type)]));
  const nodeTypes = sortedUnique(graph.nodes.map((node) => clean(node.type)));
  const superTypes = sortedUnique(graph.nodes.flatMap((node) => node.superTypes ?? []).map(clean));
  const generatorTypes = sortedUnique(graph.nodes.flatMap((node) => node.generatorTypes ?? []).map(clean));
  const animatedAttributes = sortedUnique(graph.nodes.flatMap((node) => node.animatedAttributes ?? []).map(clean));
  const roles = sortedUnique(graph.nodes.map((node) => clean(node.role)).filter(Boolean));
  const topology = sortedUnique(graph.edges.map((edge) => {
    const from = originalTypes.get(clean(edge.from)) ?? clean(edge.from);
    const to = originalTypes.get(clean(edge.to)) ?? clean(edge.to);
    return `${from}:${clean(edge.fromAttribute) || '*'}>${edge.kind ?? 'connection'}>${to}:${clean(edge.toAttribute) || '*'}`;
  }));
  const canonical = JSON.stringify({ nodeTypes, superTypes, generatorTypes, topology, animatedAttributes, roles });
  return { nodeTypes, superTypes, generatorTypes, topology, animatedAttributes, roles, hash: contentHash(canonical) };
}

function weightedJaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / union.size;
}

export function graphSimilarity(a: GraphFingerprint, b: GraphFingerprint): number {
  return (
    weightedJaccard(a.nodeTypes, b.nodeTypes) * 0.3 +
    weightedJaccard(a.topology, b.topology) * 0.35 +
    weightedJaccard(a.generatorTypes, b.generatorTypes) * 0.1 +
    weightedJaccard(a.superTypes, b.superTypes) * 0.08 +
    weightedJaccard(a.animatedAttributes, b.animatedAttributes) * 0.1 +
    weightedJaccard(a.roles, b.roles) * 0.07
  );
}

export function sceneFromInspection(name: string, raw: Record<string, unknown>, filePath?: string): SceneKnowledge {
  const rawLayers = Array.isArray(raw.layers) ? raw.layers : [];
  const nodes: GraphNode[] = rawLayers.map((layer: any, index) => ({
    key: clean(layer.id ?? layer.layerId ?? layer.uuid ?? `layer-${index}`),
    type: clean(layer.type ?? layer.layerType ?? 'unknown'),
    superTypes: Array.isArray(layer.superTypes) ? layer.superTypes.map(String) : [],
    role: typeof layer.role === 'string' ? layer.role : undefined,
    generatorTypes: [layer.generatorType, ...(Array.isArray(layer.generators) ? layer.generators.map((item: any) => item.type ?? item) : [])].filter(Boolean).map(String),
    animatedAttributes: Array.isArray(layer.animatedAttributes)
      ? layer.animatedAttributes.map((item: any) => String(item.path ?? item))
      : Object.entries(layer.attributes ?? {}).filter(([, value]: any) => value?.animated || Array.isArray(value?.keyframes)).map(([path]) => path),
    attributes: typeof layer.attributes === 'object' ? layer.attributes : undefined,
  }));
  const rawConnections = Array.isArray(raw.connections) ? raw.connections : [];
  const edges: GraphEdge[] = rawConnections.map((connection: any) => ({
    from: edgeEndpoint(connection, ['fromLayerId', 'fromLayer', 'sourceLayer', 'from', 'source']),
    to: edgeEndpoint(connection, ['toLayerId', 'toLayer', 'targetLayer', 'to', 'target']),
    fromAttribute: edgeEndpoint(connection, ['fromAttribute', 'sourceAttribute', 'output']),
    toAttribute: edgeEndpoint(connection, ['toAttribute', 'targetAttribute', 'input']),
    kind: 'connection' as const,
  })).filter((edge) => edge.from && edge.to);
  for (const layer of rawLayers as any[]) {
    const child = clean(layer.id ?? layer.layerId ?? layer.uuid);
    const parent = clean(layer.parentId ?? layer.parent);
    if (child && parent) edges.push({ from: parent, to: child, kind: 'hierarchy' });
  }
  const compositionRaw = (raw.composition ?? raw.activeComposition ?? {}) as Record<string, unknown>;
  const graph = normalizeSceneGraph({ nodes, edges });
  return {
    name,
    filePath,
    composition: {
      width: Number(compositionRaw.width) || undefined,
      height: Number(compositionRaw.height) || undefined,
      fps: Number(compositionRaw.fps) || undefined,
      startFrame: Number(compositionRaw.startFrame) || undefined,
      endFrame: Number(compositionRaw.endFrame) || undefined,
    },
    graph,
    hierarchy: raw.hierarchy,
    markers: Array.isArray(raw.markers) ? raw.markers : [],
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
  };
}
