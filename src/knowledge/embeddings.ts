export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_.#-]+/g) ?? [];
}

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local-hash-v1';
  readonly dimensions: number;

  constructor(dimensions = 256) { this.dimensions = dimensions; }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array<number>(this.dimensions).fill(0);
      const terms = tokens(text);
      for (const term of terms) {
        const hash = fnv1a(term);
        vector[hash % this.dimensions] += (hash & 1) === 0 ? 1 : -1;
      }
      const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      return magnitude ? vector.map((value) => value / magnitude) : vector;
    });
  }
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;

  constructor(
    private readonly endpoint: string,
    private readonly model: string,
    private readonly apiKey: string,
    readonly dimensions: number,
  ) { this.id = `remote:${model}`; }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dimensions }),
    });
    if (!response.ok) throw new Error(`Remote embedding provider returned HTTP ${response.status}`);
    const payload = await response.json() as { data?: Array<{ embedding?: number[]; index?: number }> };
    const vectors = (payload.data ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((item) => item.embedding ?? []);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== this.dimensions)) throw new Error('Remote embedding response had unexpected dimensions');
    return vectors;
  }
}

export class FallbackEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;

  constructor(private readonly primary: EmbeddingProvider, private readonly fallback: EmbeddingProvider) {
    if (primary.dimensions !== fallback.dimensions) throw new Error('Embedding fallback dimensions must match the primary provider');
    this.id = `${primary.id}+fallback:${fallback.id}`;
    this.dimensions = primary.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try { return await this.primary.embed(texts); }
    catch { return this.fallback.embed(texts); }
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const dimensions = Number(process.env.CAVALRY_KNOWLEDGE_EMBEDDING_DIMENSIONS ?? 256);
  const local = new LocalHashEmbeddingProvider(dimensions);
  if (process.env.CAVALRY_KNOWLEDGE_EMBEDDING_MODE !== 'remote') return local;
  const endpoint = process.env.CAVALRY_KNOWLEDGE_EMBEDDING_ENDPOINT;
  const model = process.env.CAVALRY_KNOWLEDGE_EMBEDDING_MODEL;
  const apiKey = process.env.CAVALRY_KNOWLEDGE_EMBEDDING_API_KEY;
  if (!endpoint || !model || !apiKey) return local;
  return new FallbackEmbeddingProvider(new HttpEmbeddingProvider(endpoint, model, apiKey, dimensions), local);
}

export function cosineSimilarity(a?: number[], b?: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    a2 += a[index] * a[index];
    b2 += b[index] * b[index];
  }
  return a2 && b2 ? dot / Math.sqrt(a2 * b2) : 0;
}
