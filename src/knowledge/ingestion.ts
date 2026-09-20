import { basename, extname, resolve } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createEmbeddingProvider, EmbeddingProvider } from './embeddings.js';
import { sceneFromInspection } from './graph.js';
import { contentHash, makeProvenance, sanitizeReferenceText, stableId } from './provenance.js';
import { DocumentKnowledgeStore } from './store.js';
import {
  ApiKnowledge,
  ComponentKnowledge,
  FailureKnowledge,
  IngestionSummary,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeSourceType,
  MotionRecipe,
  ScriptKnowledge,
  VerificationStatus,
  VisualOutcomeKnowledge,
} from './types.js';

export interface IngestOptions {
  sourceType: KnowledgeSourceType;
  scope?: KnowledgeScope;
  projectId?: string;
  sessionId?: string;
  cavalryVersion?: string;
  sourceUrl?: string;
  license?: string;
  redistributable?: boolean;
  verified?: boolean;
}

interface SemanticSection { title: string; section?: string; content: string }

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'are', 'use']);
const API_MCP_EQUIVALENTS: Record<string, string[]> = {
  create: ['layer_create'], primitive: ['layer_create_primitive'], getSelection: ['layer_get_selection'], select: ['layer_select'],
  set: ['attribute_set'], get: ['attribute_get'], connect: ['graph_connect'], disconnect: ['graph_disconnect'],
  setKeyframe: ['keyframe_create'], deleteKeyframe: ['keyframe_delete'], renderPNGFrame: ['preview_frame'],
  openScene: ['scene_open'], saveScene: ['scene_save'], addRenderQueueItem: ['render_queue_add'],
};
const terms = (value: string): string[] => [...new Set((value.toLowerCase().match(/[a-z0-9_.#-]+/g) ?? []).filter((item) => item.length > 2 && !STOP_WORDS.has(item)))];

function inferEntities(content: string): string[] {
  const identifiers = content.match(/\b(?:api\.[A-Za-z0-9_]+|[A-Z][A-Za-z]+(?:Shape|Distribution|Duplicator|Stagger|Falloff|Deformer|Layer|Generator)?|[a-z]+#[0-9]+)\b/g) ?? [];
  return [...new Set(identifiers)].slice(0, 80);
}

function recordFromSection(source: string, section: SemanticSection, options: IngestOptions): KnowledgeRecord {
  const now = new Date().toISOString();
  const cleanContent = sanitizeReferenceText(section.content.trim());
  const sectionKey = section.section || section.title;
  return {
    id: stableId(options.sourceType, source, sectionKey),
    sourceType: options.sourceType,
    scope: options.scope ?? 'global',
    projectId: options.projectId,
    sessionId: options.sessionId,
    title: section.title,
    section: section.section,
    content: cleanContent,
    cavalryVersion: options.cavalryVersion,
    entities: inferEntities(cleanContent),
    operations: [...new Set(cleanContent.match(/\b(?:layer|attribute|graph|generator|scene|keyframe|render|preview)_[a-z0-9_]+\b/g) ?? [])],
    tags: terms(`${section.title} ${section.section ?? ''}`).slice(0, 16),
    status: options.verified ? 'verified' : 'unverified',
    provenance: makeProvenance(options.sourceType, source, cleanContent, {
      sourceUrl: options.sourceUrl,
      license: options.license,
      redistributable: options.redistributable,
      retrievedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

export function parseMarkdownSemantically(markdown: string, fallbackTitle: string): SemanticSection[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const sections: SemanticSection[] = [];
  let pageTitle = fallbackTitle;
  let heading = '';
  let buffer: string[] = [];
  let inFence = false;
  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content) sections.push({ title: pageTitle, section: heading || pageTitle, content });
    buffer = [];
  };
  for (const line of lines) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    const match = !inFence ? /^(#{1,4})\s+(.+?)\s*$/.exec(line) : null;
    if (match) {
      flush();
      if (match[1].length === 1) pageTitle = match[2];
      heading = match[2];
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections.length ? sections : [{ title: fallbackTitle, content: markdown }];
}

export function parseHtmlSemantically(html: string, fallbackTitle: string): SemanticSection[] {
  const withoutNoise = html
    .replace(/<(nav|footer|script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, code) => `\n\`\`\`\n${code.replace(/<[^>]+>/g, '')}\n\`\`\`\n`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, code) => `\`${code.replace(/<[^>]+>/g, '')}\``)
    .replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, title) => `\n${'#'.repeat(Number(level))} ${title.replace(/<[^>]+>/g, '')}\n`)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ');
  return parseMarkdownSemantically(withoutNoise, fallbackTitle);
}

export class KnowledgeIngestor {
  constructor(
    private readonly store: DocumentKnowledgeStore,
    private readonly embeddings: EmbeddingProvider = createEmbeddingProvider(),
  ) {}

  private async persist(records: KnowledgeRecord[], source?: string): Promise<IngestionSummary> {
    const vectors = await this.embeddings.embed(records.map((record) => `${record.title}\n${record.section ?? ''}\n${record.content}\n${record.entities.join(' ')}`));
    records.forEach((record, index) => { record.embedding = vectors[index]; });
    const counts = await this.store.upsertMany(records);
    const deleted = source ? await this.store.deleteMissing(source, new Set(records.map((record) => record.id))) : 0;
    if (deleted) await this.store.save(this.embeddings.id);
    return { ...counts, deleted, failed: [] };
  }

  async ingestDocument(filePath: string, options: IngestOptions): Promise<IngestionSummary> {
    const localPath = resolve(filePath);
    const source = options.sourceUrl ?? localPath;
    const raw = await readFile(localPath, 'utf8');
    const extension = extname(localPath).toLowerCase();
    const sections = extension === '.html' || extension === '.htm'
      ? parseHtmlSemantically(raw, basename(localPath))
      : parseMarkdownSemantically(raw, basename(localPath));
    const sectionOccurrences = new Map<string, number>();
    const records = sections.map((section) => {
      const key = section.section || section.title;
      const occurrence = sectionOccurrences.get(key) ?? 0;
      sectionOccurrences.set(key, occurrence + 1);
      const record = recordFromSection(source, section, options);
      if (occurrence) record.id = stableId(options.sourceType, source, `${key}#${occurrence + 1}`);
      return record;
    });
    return this.persist(records, source);
  }

  async ingestApiFile(filePath: string, options: Omit<IngestOptions, 'sourceType'> = {}): Promise<IngestionSummary> {
    const source = resolve(filePath);
    const raw = await readFile(source, 'utf8');
    const parsed = JSON.parse(raw);
    const candidates: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.methods) ? parsed.methods : Object.entries(parsed).map(([name, value]) => ({ name, ...(value as object) }));
    const now = new Date().toISOString();
    const records = candidates.map((entry, index) => {
      const name = String(entry.name ?? entry.method ?? entry.function ?? `api-entry-${index}`);
      const api: ApiKnowledge = {
        name: name.startsWith('api.') ? name : `api.${name}`,
        category: entry.category ?? entry.namespace ?? entry.namespaces?.join(','),
        parameters: entry.parameters ?? entry.params ?? entry.arguments ?? [],
        returns: entry.returns ?? entry.returnType ?? entry.return_type,
        notes: [entry.description, entry.rationale, ...(entry.notes ?? [])].filter(Boolean),
        examples: entry.examples ?? [],
        deprecated: Boolean(entry.deprecated),
        mcpEquivalent: entry.mcpEquivalent ?? API_MCP_EQUIVALENTS[name] ?? (entry.route === 'bridge' ? [] : undefined),
      };
      const content = JSON.stringify(api);
      return {
        ...recordFromSection(source, { title: api.name, section: api.category, content }, { ...options, sourceType: 'official_api', verified: true }),
        id: stableId('official_api', source, api.name),
        api,
        status: api.deprecated ? 'deprecated' as const : 'verified' as const,
        createdAt: now,
        updatedAt: now,
      };
    });
    return this.persist(records, source);
  }

  async ingestSceneInspection(name: string, inspection: Record<string, unknown>, options: Omit<IngestOptions, 'sourceType'> & { filePath?: string } = {}): Promise<IngestionSummary> {
    const source = options.filePath ? resolve(options.filePath) : `inspection:${name}`;
    const scene = sceneFromInspection(name, inspection, options.filePath);
    const content = scene.summary || `Scene ${name}. Nodes: ${scene.graph.fingerprint?.nodeTypes.join(', ')}. Topology: ${scene.graph.fingerprint?.topology.join('; ')}.`;
    const record = recordFromSection(source, { title: name, section: 'scene graph', content }, { ...options, sourceType: 'real_scene' });
    record.scene = scene;
    record.entities = scene.graph.fingerprint?.nodeTypes ?? [];
    record.tags = [...new Set([...record.tags, 'scene-graph', ...(scene.graph.fingerprint?.roles ?? [])])];
    return this.persist([record], source);
  }

  async ingestSceneSnapshotFile(filePath: string, options: Omit<IngestOptions, 'sourceType'> = {}): Promise<IngestionSummary> {
    if (extname(filePath).toLowerCase() === '.cv') throw new Error('Binary or undocumented .cv files are not parsed externally. Inspect the scene through Cavalry, then ingest the returned scene inspection.');
    return this.ingestSceneInspection(basename(filePath, extname(filePath)), JSON.parse(await readFile(filePath, 'utf8')), { ...options, filePath });
  }

  async ingestRecipe(recipe: MotionRecipe, options: Omit<IngestOptions, 'sourceType'> & { source?: string } = {}): Promise<IngestionSummary> {
    const source = options.source ?? `recipe:${recipe.name}`;
    const record = recordFromSection(source, { title: recipe.name, section: recipe.category, content: `${recipe.description}\n${recipe.construction.join('\n')}` }, { ...options, sourceType: 'motion_recipe', verified: options.verified });
    record.recipe = recipe;
    record.operations = recipe.preferredMcpOperations ?? [];
    record.tags = [...new Set([...record.tags, recipe.category, ...(recipe.variants ?? [])])];
    return this.persist([record]);
  }

  async ingestScript(script: ScriptKnowledge, options: Omit<IngestOptions, 'sourceType'> & { source?: string } = {}): Promise<IngestionSummary> {
    const source = options.source ?? `script:${contentHash(script.script).slice(0, 12)}`;
    const record = recordFromSection(source, { title: script.task, section: `script/${script.status}`, content: `${script.task}\n${script.script}` }, { ...options, sourceType: 'verified_script', verified: script.status === 'verified' });
    record.script = script;
    record.status = script.status;
    return this.persist([record]);
  }

  async ingestFailure(failure: FailureKnowledge, options: Omit<IngestOptions, 'sourceType'> & { source?: string } = {}): Promise<IngestionSummary> {
    const source = options.source ?? `failure:${contentHash(`${failure.intent}:${failure.error}`).slice(0, 12)}`;
    const record = recordFromSection(source, { title: failure.intent, section: failure.category ?? 'failure', content: `${failure.approach}\n${failure.error}\n${failure.cause ?? ''}\nWorkaround: ${failure.solution}` }, { ...options, sourceType: 'failure', verified: Boolean(failure.verifiedReplacement) });
    record.failure = failure;
    record.operations = failure.mcpOperation ? [failure.mcpOperation] : [];
    return this.persist([record]);
  }

  async ingestComponent(component: ComponentKnowledge, options: Omit<IngestOptions, 'sourceType'> & { source?: string } = {}): Promise<IngestionSummary> {
    const source = options.source ?? component.path ?? `component:${component.name}`;
    const record = recordFromSection(source, { title: component.name, section: 'component', content: `${component.description}\n${component.requiredInputs?.join(', ') ?? ''}\n${component.limitations?.join(', ') ?? ''}` }, { ...options, sourceType: 'component', verified: options.verified });
    record.component = component;
    return this.persist([record]);
  }

  async ingestVisualOutcome(outcome: VisualOutcomeKnowledge, options: Omit<IngestOptions, 'sourceType'> & { source?: string } = {}): Promise<IngestionSummary> {
    if (!outcome.qaPassed) throw new Error('Only meaningful visual outcomes with qaPassed=true may enter success memory');
    const source = options.source ?? `visual-outcome:${contentHash(`${outcome.intent}:${JSON.stringify(outcome.sceneFingerprint ?? {})}`).slice(0, 12)}`;
    const content = `${outcome.intent}\nRecipe: ${outcome.recipeUsed ?? 'unspecified'}\n${outcome.notes?.join('\n') ?? ''}\n${outcome.issues?.map((item) => `${item.issue}: ${item.fix ?? ''}`).join('\n') ?? ''}`;
    const record = recordFromSection(source, { title: outcome.intent, section: 'approved visual outcome', content }, { ...options, sourceType: 'visual_outcome', verified: true });
    record.visualOutcome = outcome;
    return this.persist([record]);
  }

  async ingestDirectory(directory: string, options: IngestOptions): Promise<IngestionSummary> {
    const aggregate: IngestionSummary = { added: 0, updated: 0, deleted: 0, unchanged: 0, failed: [] };
    const visit = async (current: string): Promise<void> => {
      for (const entry of await readdir(current)) {
        const path = resolve(current, entry);
        const info = await stat(path);
        if (info.isDirectory()) await visit(path);
        else if (['.md', '.markdown', '.html', '.htm'].includes(extname(path).toLowerCase())) {
          try {
            const result = await this.ingestDocument(path, options);
            aggregate.added += result.added; aggregate.updated += result.updated; aggregate.deleted += result.deleted; aggregate.unchanged += result.unchanged;
          } catch (error) { aggregate.failed.push({ source: path, error: error instanceof Error ? error.message : String(error) }); }
        }
      }
    };
    await visit(resolve(directory));
    return aggregate;
  }
}
