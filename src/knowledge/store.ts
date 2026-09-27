import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { KnowledgeRecord, KnowledgeScope, KnowledgeSourceType } from './types.js';
import { knowledgeDataPath, knowledgeSeedPath } from '../utils/paths.js';

interface StoreFile {
  schemaVersion: 1;
  embeddingProvider?: string;
  updatedAt: string;
  records: KnowledgeRecord[];
}

const EMPTY: StoreFile = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), records: [] };

export class DocumentKnowledgeStore {
  readonly filePath: string;
  readonly seedPath?: string;
  private loaded = false;
  private records = new Map<string, KnowledgeRecord>();
  private seedRecords = new Map<string, KnowledgeRecord>();

  constructor(filePath?: string, seedPath?: string) {
    this.filePath = filePath ? resolve(filePath) : knowledgeDataPath();
    this.seedPath = seedPath ?? (filePath ? undefined : knowledgeSeedPath());
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    const loadFile = async (target: string, seed: boolean): Promise<void> => {
      const data = JSON.parse(await readFile(target, 'utf8')) as StoreFile;
      if (data.schemaVersion !== 1 || !Array.isArray(data.records)) throw new Error('Unsupported knowledge store schema');
      for (const record of data.records) {
        this.records.set(record.id, record);
        if (seed) this.seedRecords.set(record.id, record);
      }
    };
    if (this.seedPath && this.seedPath !== this.filePath) {
      try { await loadFile(this.seedPath, true); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    }
    try { await loadFile(this.filePath, false); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
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
      // Keep the installed seed immutable. Only user records and overrides are
      // written to the private user-data store.
      records: [...this.records.values()]
        .filter((record) => this.seedRecords.get(record.id)?.provenance.contentHash !== record.provenance.contentHash)
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async clear(): Promise<void> {
    this.records = new Map(this.seedRecords);
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
