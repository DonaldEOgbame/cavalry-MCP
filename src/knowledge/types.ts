export const SOURCE_TYPES = [
  'runtime_introspection',
  'official_api',
  'official_docs',
  'verified_script',
  'acceptance_test',
  'real_scene',
  'motion_recipe',
  'component',
  'failure',
  'visual_outcome',
  'motion_principle',
  'third_party',
  'community',
] as const;

export type KnowledgeSourceType = typeof SOURCE_TYPES[number];
export type KnowledgeScope = 'global' | 'project' | 'session';
export type VerificationStatus = 'verified' | 'unverified' | 'deprecated' | 'failed';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RetrievalMode = 'compact' | 'normal' | 'detailed';

export interface Provenance {
  sourceType: KnowledgeSourceType;
  source: string;
  sourceUrl?: string;
  license?: string;
  redistributable?: boolean;
  retrievedAt?: string;
  contentHash: string;
}

export interface GraphNode {
  key: string;
  type: string;
  superTypes?: string[];
  role?: string;
  generatorTypes?: string[];
  animatedAttributes?: string[];
  attributes?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  fromAttribute?: string;
  toAttribute?: string;
  kind?: 'connection' | 'hierarchy' | 'generator';
}

export interface SceneGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  fingerprint?: GraphFingerprint;
}

export interface GraphFingerprint {
  nodeTypes: string[];
  superTypes: string[];
  generatorTypes: string[];
  topology: string[];
  animatedAttributes: string[];
  roles: string[];
  hash: string;
}

export interface ApiKnowledge {
  name: string;
  category?: string;
  parameters?: Array<{ name: string; type?: string; required?: boolean; description?: string }>;
  returns?: string;
  notes?: string[];
  examples?: string[];
  deprecated?: boolean;
  mcpEquivalent?: string[];
}

export interface ScriptKnowledge {
  task: string;
  status: VerificationStatus;
  script: string;
  inputAssumptions?: string[];
  result?: unknown;
  createdObjects?: string[];
  modifiedObjects?: string[];
  errors?: string[];
  validation?: { passed: boolean; checks?: string[] };
}

export interface MotionRecipe {
  name: string;
  category: string;
  description: string;
  requirements: string[];
  construction: string[];
  animation?: Record<string, unknown>;
  easing?: Record<string, unknown>;
  variants?: string[];
  preferredMcpOperations?: string[];
  fallback?: 'cavalry_raw_script' | 'ui_fallback' | 'none';
}

export interface FailureKnowledge {
  intent: string;
  approach: string;
  mcpOperation?: string;
  error: string;
  category?: string;
  cause?: string;
  solution: string;
  verifiedReplacement?: string;
}

export interface ComponentKnowledge {
  name: string;
  path?: string;
  description: string;
  requiredInputs?: string[];
  exposedAttributes?: string[];
  aspectRatios?: string[];
  expectedDurationFrames?: number;
  editableProperties?: string[];
  visualStyle?: string[];
  limitations?: string[];
}

export interface SceneKnowledge {
  name: string;
  filePath?: string;
  composition?: { width?: number; height?: number; fps?: number; startFrame?: number; endFrame?: number };
  graph: SceneGraph;
  hierarchy?: unknown;
  markers?: unknown[];
  assets?: unknown[];
  summary?: string;
}

export interface VisualOutcomeKnowledge {
  intent: string;
  sceneFingerprint?: GraphFingerprint;
  recipeUsed?: string;
  previewFrames?: string[];
  timing?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  notes?: string[];
  qaPassed: boolean;
  issues?: Array<{ issue: string; fix?: string }>;
}

export interface KnowledgeRecord {
  id: string;
  sourceType: KnowledgeSourceType;
  scope: KnowledgeScope;
  projectId?: string;
  sessionId?: string;
  title: string;
  section?: string;
  content: string;
  cavalryVersion?: string;
  entities: string[];
  operations: string[];
  tags: string[];
  status: VerificationStatus;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
  api?: ApiKnowledge;
  script?: ScriptKnowledge;
  recipe?: MotionRecipe;
  failure?: FailureKnowledge;
  component?: ComponentKnowledge;
  scene?: SceneKnowledge;
  visualOutcome?: VisualOutcomeKnowledge;
  embedding?: number[];
}

export interface RuntimeKnowledgeContext {
  cavalryVersion?: string;
  layerTypes?: string[];
  availableOperations?: string[];
  unavailableOperations?: string[];
}

export interface SearchFilters {
  sourceTypes?: KnowledgeSourceType[];
  scopes?: KnowledgeScope[];
  projectId?: string;
  sessionId?: string;
  layerTypes?: string[];
  categories?: string[];
  verifiedOnly?: boolean;
  cavalryVersion?: string;
  tags?: string[];
  limit?: number;
}

export interface RankedKnowledgeResult {
  record: KnowledgeRecord;
  score: number;
  relevance: number;
  authority: number;
  versionCompatibility: 'same' | 'compatible' | 'different' | 'unknown';
  graphSimilarity?: number;
  confidence: { level: ConfidenceLevel; reasons: string[] };
  warnings: string[];
}

export interface KnowledgeSearchResult {
  query: string;
  summary: string;
  results: RankedKnowledgeResult[];
  runtimeCompatibility: { supported: boolean; missing: string[]; cavalryVersion?: string };
  preferredMcpOperations: string[];
  warnings: string[];
  untrustedReferenceNotice: string;
}

export interface IngestionSummary {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  failed: Array<{ source: string; error: string }>;
}
