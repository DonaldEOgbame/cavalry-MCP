import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { KnowledgeRecord, KnowledgeScope, KnowledgeSourceType } from './types.js';

interface StoreFile {
  schemaVersion: 1;
  embeddingProvider?: string;
  updatedAt: string;
  records: KnowledgeRecord[];
}

const EMPTY: StoreFile = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), records: [] };

export class DocumentKnowledgeStore {
  readonly filePath: string;
  private loaded = false;
  private records = new Map<string, KnowledgeRecord>();

  constructor(filePath = process.env.CAVALRY_KNOWLEDGE_DB || resolve(process.cwd(), 'knowledge/generated/knowledge-index.json')) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8')) as StoreFile;
      if (data.schemaVersion !== 1 || !Array.isArray(data.records)) throw new Error('Unsupported knowledge store schema');
      for (const record of data.records) this.records.set(record.id, record);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }

  async all(): Promise<KnowledgeRecord[]> {
    await this.load();
    return [...this.records.values()];
  }

  async get(id: string): Promise<KnowledgeRecord | undefined> {
    await this.load();
    return this.records.get(id);
  }

  async upsert(record: KnowledgeRecord): Promise<'added' | 'updated' | 'unchanged'> {
    await this.load();
    const previous = this.records.get(record.id);
    if (previous?.provenance.contentHash === record.provenance.contentHash) return 'unchanged';
    this.records.set(record.id, previous ? { ...record, createdAt: previous.createdAt } : record);
    return previous ? 'updated' : 'added';
  }

  async upsertMany(records: KnowledgeRecord[]): Promise<{ added: number; updated: number; unchanged: number }> {
    const result = { added: 0, updated: 0, unchanged: 0 };
    for (const record of records) result[await this.upsert(record)] += 1;
    await this.save();
    return result;
  }

  async deleteMissing(source: string, retainedIds: Set<string>): Promise<number> {
    await this.load();
    let deleted = 0;
    for (const [id, record] of this.records) {
      if (record.provenance.source === source && !retainedIds.has(id)) {
        this.records.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }

  async remove(id: string): Promise<boolean> {
    await this.load();
    const removed = this.records.delete(id);
    if (removed) await this.save();
    return removed;
  }

  async save(embeddingProvider?: string): Promise<void> {
    await this.load();
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    const data: StoreFile = {
      ...EMPTY,
      embeddingProvider,
      updatedAt: new Date().toISOString(),
      records: [...this.records.values()].sort((a, b) => a.id.localeCompare(b.id)),
    };
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async clear(): Promise<void> {
    this.records.clear();
    this.loaded = true;
    try { await unlink(this.filePath); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }

  static isVisible(record: KnowledgeRecord, scopes: KnowledgeScope[], projectId?: string, sessionId?: string): boolean {
    if (!scopes.includes(record.scope)) return false;
    if (record.scope === 'project') return Boolean(projectId && record.projectId === projectId);
    if (record.scope === 'session') return Boolean(sessionId && record.sessionId === sessionId);
    return true;
  }

  async counts(): Promise<Record<KnowledgeSourceType, number>> {
    const counts = Object.create(null) as Record<KnowledgeSourceType, number>;
    for (const record of await this.all()) counts[record.sourceType] = (counts[record.sourceType] ?? 0) + 1;
    return counts;
  }
}
