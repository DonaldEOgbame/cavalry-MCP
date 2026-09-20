import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { getCapabilities } from '../cavalry/capabilities.js';
import { sceneInspect } from '../cavalry/scene.js';
import { fingerprintGraph } from './graph.js';
import { KnowledgeIngestor } from './ingestion.js';
import { CORE_RECIPES } from './recipes.js';
import { HybridKnowledgeSearch } from './search.js';
import { DocumentKnowledgeStore } from './store.js';
import {
  FailureKnowledge,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeSearchResult,
  KnowledgeSourceType,
  MotionRecipe,
  RetrievalMode,
  RuntimeKnowledgeContext,
  SearchFilters,
  ScriptKnowledge,
  VisualOutcomeKnowledge,
} from './types.js';

const COVERAGE_AREAS = [
  'Scene', 'Compositions', 'Shapes', 'Text', 'Duplicators', 'Stagger', 'Distributions', 'Falloffs', 'Fields',
  'Constraints', 'Deformers', 'Filters', 'Shaders', 'Materials', 'Keyframes', 'Graph Editor', 'Editable Paths',
  'Audio', 'Assets', 'Data', 'Camera', 'Render Manager', 'Components', 'Control Centre', 'JavaScript', 'Third-party plugins',
];

const toolNamePattern = /server\.tool\('([^']+)'/g;

async function localMcpOperations(): Promise<string[]> {
  try {
    const source = await readFile(resolve(process.cwd(), 'src/mcp/server.ts'), 'utf8');
    return [...source.matchAll(toolNamePattern)].map((match) => match[1]);
  } catch { return []; }
}

async function runtimeContext(live = false): Promise<RuntimeKnowledgeContext> {
  const availableOperations = await localMcpOperations();
  if (!live) {
    try {
      const matrix = JSON.parse(await readFile(resolve(process.cwd(), 'coverage/cavalry-capabilities.json'), 'utf8'));
      return { cavalryVersion: matrix.supportedCavalryVersion, availableOperations };
    } catch { return { availableOperations }; }
  }
  const capabilities = await getCapabilities();
  return {
    cavalryVersion: capabilities.cavalryVersion,
    layerTypes: capabilities.supportedLayerTypes.map((item) => item.type),
    availableOperations,
  };
}

function presentSearch(result: KnowledgeSearchResult, mode: RetrievalMode): KnowledgeSearchResult {
  return {
    ...result,
    results: result.results.map((item) => ({
      ...item,
      record: {
        ...item.record,
        content: mode === 'detailed' ? item.record.content : item.record.content.slice(0, mode === 'compact' ? 320 : 1200),
        embedding: undefined,
        ...(mode === 'compact' ? { visualOutcome: undefined } : {}),
      },
    })),
  };
}

function recordText(record: KnowledgeRecord): string {
  return `${record.title} ${record.section ?? ''} ${record.content} ${record.entities.join(' ')} ${record.tags.join(' ')}`.toLowerCase();
}

export class CavalryKnowledgeEngine {
  readonly store: DocumentKnowledgeStore;
  readonly ingestion: KnowledgeIngestor;
  readonly retrieval: HybridKnowledgeSearch;

  constructor(store = new DocumentKnowledgeStore()) {
    this.store = store;
    this.ingestion = new KnowledgeIngestor(store);
    this.retrieval = new HybridKnowledgeSearch(store);
  }

  async search(query: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal', liveRuntime = false): Promise<KnowledgeSearchResult> {
    return presentSearch(await this.retrieval.search(query, filters, await runtimeContext(liveRuntime), mode), mode);
  }

  async explain(concept: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal'): Promise<Record<string, unknown>> {
    const result = await this.search(`${concept} typical use cases graph patterns attributes pitfalls`, filters, mode);
    return {
      concept,
      explanation: result.summary,
      commonGraphPatterns: result.results.flatMap((item) => item.record.scene?.graph.fingerprint?.topology ?? []).slice(0, 12),
      relatedLayers: [...new Set(result.results.flatMap((item) => item.record.entities))].slice(0, 20),
      importantAttributes: [...new Set(result.results.flatMap((item) => item.record.scene?.graph.fingerprint?.animatedAttributes ?? []))].slice(0, 20),
      mcpOperations: result.preferredMcpOperations,
      evidence: result.results,
      warnings: result.warnings,
      untrustedReferenceNotice: result.untrustedReferenceNotice,
    };
  }

  async findScenePattern(description: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(description, { ...filters, sourceTypes: ['real_scene'], limit: filters.limit ?? 8 }, mode);
  }

  async findScriptPattern(description: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(description, { ...filters, sourceTypes: ['verified_script'], limit: filters.limit ?? 8 }, mode);
  }

  async findRecipe(description: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(description, { ...filters, sourceTypes: ['motion_recipe'], limit: filters.limit ?? 8 }, mode);
  }

  async findComponent(description: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(description, { ...filters, sourceTypes: ['component'], limit: filters.limit ?? 8 }, mode);
  }

  async findFailure(intent: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(intent, { ...filters, sourceTypes: ['failure'], limit: filters.limit ?? 8 }, mode);
  }

  async findSuccessPattern(intent: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    const result = await this.search(intent, { ...filters, verifiedOnly: true, sourceTypes: ['verified_script', 'acceptance_test', 'real_scene', 'visual_outcome'], limit: filters.limit ?? 8 }, mode);
    return result;
  }

  async getApi(name: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(name, { ...filters, sourceTypes: ['official_api'], limit: filters.limit ?? 5 }, mode);
  }

  async getLayerGuidance(layerType: string, filters: SearchFilters = {}, mode: RetrievalMode = 'normal') {
    return this.search(`${layerType} layer typical attributes connections examples pitfalls`, { ...filters, layerTypes: [...new Set([...(filters.layerTypes ?? []), layerType])] }, mode);
  }

  async getNodeGraph(description: string, filters: SearchFilters = {}) {
    const result = await this.search(description, { ...filters, sourceTypes: ['real_scene', 'motion_recipe'] }, 'normal');
    return {
      query: description,
      graphs: result.results.map((item) => ({ title: item.record.title, graph: item.record.scene?.graph, construction: item.record.recipe?.construction, score: item.score, provenance: item.record.provenance })),
      warnings: result.warnings,
    };
  }

  async findSimilarToCurrentScene(filters: SearchFilters = {}) {
    const inspection = await sceneInspect(true);
    const { sceneFromInspection } = await import('./graph.js');
    const current = sceneFromInspection('current-scene', inspection);
    const runtime = await runtimeContext(true);
    const result = await this.retrieval.search('structurally similar Cavalry scene', { ...filters, sourceTypes: ['real_scene'] }, runtime, 'normal', current.graph.fingerprint ?? fingerprintGraph(current.graph));
    return { currentFingerprint: current.graph.fingerprint, ...presentSearch(result, 'normal') };
  }

  async motionPlan(goal: string, currentSceneSummary?: string, assets: string[] = [], liveRuntime = false): Promise<Record<string, unknown>> {
    const runtime = await runtimeContext(liveRuntime);
    const filters: SearchFilters = { scopes: ['session', 'project', 'global'], cavalryVersion: runtime.cavalryVersion, limit: 6 };
    const [recipes, scenes, failures, docs] = await Promise.all([
      this.retrieval.search(goal, { ...filters, sourceTypes: ['motion_recipe'] }, runtime, 'compact'),
      this.retrieval.search(goal, { ...filters, sourceTypes: ['real_scene'] }, runtime, 'compact'),
      this.retrieval.search(goal, { ...filters, sourceTypes: ['failure'] }, runtime, 'compact'),
      this.retrieval.search(goal, { ...filters, sourceTypes: ['official_docs', 'official_api', 'runtime_introspection'] }, runtime, 'compact'),
    ]);
    const recipe = recipes.results[0]?.record.recipe;
    const construction = recipe?.construction ?? ['Inspect the active scene.', 'Validate required layer types and attributes.', 'Build the smallest supported graph.', 'Render and verify a preview.'];
    const preferred = [...new Set([...(recipe?.preferredMcpOperations ?? []), ...scenes.preferredMcpOperations, ...docs.preferredMcpOperations])];
    const available = new Set(runtime.availableOperations ?? []);
    const executable = preferred.filter((operation) => available.has(operation));
    const missing = preferred.filter((operation) => !available.has(operation));
    return {
      goal,
      currentSceneSummary,
      availableAssets: assets,
      strategy: recipe ? `${recipe.name}: ${recipe.description}` : 'Evidence-limited construction plan',
      approach: recipe?.category?.includes('shape_motion') || /\b(?:dots?|copies|repeat|radial|circle|grid|wave|stagger)\b/i.test(goal) ? 'CAVALRY_NATIVE_PROCEDURAL' : 'SIMPLEST_SUPPORTED_APPROACH',
      steps: construction,
      preferredExecution: executable,
      fallback: missing.length ? (recipe?.fallback ?? 'cavalry_raw_script') : 'none',
      runtimeCompatibility: { cavalryVersion: runtime.cavalryVersion, supported: missing.length === 0, missing },
      evidence: {
        recipes: presentSearch(recipes, 'compact').results,
        scenes: presentSearch(scenes, 'compact').results,
        documentation: presentSearch(docs, 'compact').results,
        previousFailures: presentSearch(failures, 'compact').results,
      },
      safety: 'This plan is advisory. Retrieved scripts are never executed by the Knowledge Engine.',
    };
  }

  async bootstrapRecipes(): Promise<{ recipes: number; added: number; updated: number; unchanged: number }> {
    const totals = { recipes: CORE_RECIPES.length, added: 0, updated: 0, unchanged: 0 };
    for (const recipe of CORE_RECIPES) {
      const result = await this.ingestion.ingestRecipe(recipe, { verified: false, source: `builtin:recipes/${recipe.name}`, cavalryVersion: '2.7.2' });
      totals.added += result.added; totals.updated += result.updated; totals.unchanged += result.unchanged;
    }
    return totals;
  }

  async addFailure(failure: FailureKnowledge, scope: KnowledgeScope = 'project', projectId?: string, cavalryVersion?: string) {
    if (scope === 'project' && !projectId) throw new Error('projectId is required for project-scoped failure memory');
    return this.ingestion.ingestFailure(failure, { scope, projectId, cavalryVersion });
  }

  async addScript(script: ScriptKnowledge, scope: KnowledgeScope = 'project', projectId?: string, cavalryVersion?: string) {
    if (script.status === 'verified' && !script.validation?.passed) throw new Error('A script can only be marked verified when validation.passed is true');
    if (scope === 'project' && !projectId) throw new Error('projectId is required for project-scoped script knowledge');
    return this.ingestion.ingestScript(script, { scope, projectId, cavalryVersion });
  }

  async indexCurrentScene(name: string, scope: KnowledgeScope = 'project', projectId?: string, sessionId?: string, verified = false) {
    if (scope === 'global') throw new Error('Current user scenes cannot be indexed globally through this tool');
    if (scope === 'project' && !projectId) throw new Error('projectId is required for project-scoped scene knowledge');
    if (scope === 'session' && !sessionId) throw new Error('sessionId is required for session-scoped scene knowledge');
    const [inspection, runtime] = await Promise.all([sceneInspect(true), runtimeContext(true)]);
    return this.ingestion.ingestSceneInspection(name, inspection, { scope, projectId, sessionId, verified, cavalryVersion: runtime.cavalryVersion });
  }

  async addVisualOutcome(outcome: VisualOutcomeKnowledge, scope: KnowledgeScope = 'project', projectId?: string, sessionId?: string, cavalryVersion?: string) {
    if (scope === 'global') throw new Error('Visual outcomes cannot be promoted globally through this tool');
    if (scope === 'project' && !projectId) throw new Error('projectId is required for project-scoped visual outcome memory');
    if (scope === 'session' && !sessionId) throw new Error('sessionId is required for session-scoped visual outcome memory');
    return this.ingestion.ingestVisualOutcome(outcome, { scope, projectId, sessionId, cavalryVersion, verified: true });
  }

  async sources() {
    const records = await this.store.all();
    const grouped = new Map<string, { sourceType: KnowledgeSourceType; source: string; count: number; scope: KnowledgeScope; cavalryVersions: Set<string> }>();
    for (const record of records) {
      const key = `${record.sourceType}\0${record.provenance.source}\0${record.scope}`;
      const item = grouped.get(key) ?? { sourceType: record.sourceType, source: record.provenance.source, count: 0, scope: record.scope, cavalryVersions: new Set<string>() };
      item.count += 1;
      if (record.cavalryVersion) item.cavalryVersions.add(record.cavalryVersion);
      grouped.set(key, item);
    }
    return [...grouped.values()].map((item) => ({ ...item, cavalryVersions: [...item.cavalryVersions] }));
  }

  async status() {
    const records = await this.store.all();
    return {
      storage: { type: 'local-json-document-store', path: this.store.filePath, embeddingProvider: 'local-hash-v1', offlineCapable: true },
      totalRecords: records.length,
      bySourceType: await this.store.counts(),
      byScope: Object.fromEntries(['global', 'project', 'session'].map((scope) => [scope, records.filter((record) => record.scope === scope).length])),
      verified: records.filter((record) => record.status === 'verified').length,
      unverified: records.filter((record) => record.status === 'unverified').length,
      cavalryVersions: [...new Set(records.map((record) => record.cavalryVersion).filter(Boolean))],
    };
  }

  async audit() {
    const records = await this.store.all();
    const hashes = new Map<string, number>();
    for (const record of records) hashes.set(record.provenance?.contentHash, (hashes.get(record.provenance?.contentHash) ?? 0) + 1);
    const duplicates = [...hashes.values()].reduce((count, value) => count + Math.max(0, value - 1), 0);
    const coverage = Object.fromEntries(COVERAGE_AREAS.map((area) => {
      const normalizedArea = area.toLowerCase().replace(' editor', '').replace(' manager', '');
      const variants = [normalizedArea, normalizedArea.replace(/s\b/g, '')];
      const matching = records.filter((record) => variants.some((variant) => recordText(record).includes(variant)));
      return [area, {
        officialDocs: matching.filter((record) => ['official_docs', 'official_api'].includes(record.sourceType)).length,
        verifiedScenes: matching.filter((record) => record.sourceType === 'real_scene' && record.status === 'verified').length,
        verifiedScripts: matching.filter((record) => record.sourceType === 'verified_script' && record.status === 'verified').length,
        recipes: matching.filter((record) => record.sourceType === 'motion_recipe').length,
        knownFailures: matching.filter((record) => record.sourceType === 'failure').length,
      }];
    }));
    return {
      totalRecords: records.length,
      recordsPerSourceType: await this.store.counts(),
      verifiedRecords: records.filter((record) => record.status === 'verified').length,
      unverifiedRecords: records.filter((record) => record.status === 'unverified').length,
      deprecatedRecords: records.filter((record) => record.status === 'deprecated').length,
      versionDistribution: Object.fromEntries([...new Set(records.map((record) => record.cavalryVersion ?? 'unversioned'))].map((version) => [version, records.filter((record) => (record.cavalryVersion ?? 'unversioned') === version).length])),
      duplicateRate: records.length ? duplicates / records.length : 0,
      orphanedRecords: records.filter((record) => !record.provenance?.source).map((record) => record.id),
      missingProvenance: records.filter((record) => !record.provenance?.sourceType || !record.provenance?.contentHash).map((record) => record.id),
      missingMetadata: records.filter((record) => !record.title || !record.sourceType || !record.scope).map((record) => record.id),
      staleDocumentation: records.filter((record) => record.sourceType === 'official_docs' && Date.now() - Date.parse(record.updatedAt) > 365 * 24 * 60 * 60 * 1000).map((record) => record.id),
      failedParsing: [],
      coverage,
    };
  }

  async refresh(sourceDirectory = resolve(process.cwd(), 'knowledge/sources')) {
    const aggregate = { added: 0, updated: 0, deleted: 0, unchanged: 0, failed: [] as Array<{ source: string; error: string }> };
    if (!existsSync(sourceDirectory)) return aggregate;
    for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
      const path = resolve(sourceDirectory, entry.name);
      try {
        let result;
        if (entry.isDirectory()) {
          const sourceType: KnowledgeSourceType = entry.name.includes('api') ? 'official_api' : entry.name.includes('third') ? 'third_party' : 'official_docs';
          result = await this.ingestion.ingestDirectory(path, { sourceType, verified: sourceType.startsWith('official') });
        } else if (extname(entry.name) === '.json' && entry.name.includes('api')) result = await this.ingestion.ingestApiFile(path, { cavalryVersion: '2.7.2' });
        else continue;
        aggregate.added += result.added; aggregate.updated += result.updated; aggregate.deleted += result.deleted; aggregate.unchanged += result.unchanged; aggregate.failed.push(...result.failed);
      } catch (error) { aggregate.failed.push({ source: path, error: error instanceof Error ? error.message : String(error) }); }
    }
    return aggregate;
  }
}

export const knowledgeEngine = new CavalryKnowledgeEngine();
