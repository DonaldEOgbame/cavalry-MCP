import { createHash } from 'node:crypto';
import { ConfidenceLevel, KnowledgeRecord, KnowledgeSourceType, Provenance } from './types.js';

const AUTHORITY: Record<KnowledgeSourceType, number> = {
  runtime_introspection: 1,
  official_api: 0.97,
  official_docs: 0.94,
  verified_script: 0.9,
  acceptance_test: 0.88,
  real_scene: 0.82,
  motion_recipe: 0.75,
  component: 0.75,
  failure: 0.74,
  visual_outcome: 0.72,
  motion_principle: 0.68,
  third_party: 0.45,
  community: 0.3,
};

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function stableId(sourceType: KnowledgeSourceType, source: string, section = ''): string {
  return `${sourceType}:${createHash('sha256').update(`${source}\0${section}`).digest('hex').slice(0, 24)}`;
}

export function makeProvenance(sourceType: KnowledgeSourceType, source: string, content: string, extras: Partial<Provenance> = {}): Provenance {
  return { sourceType, source, contentHash: contentHash(content), ...extras };
}

export function authorityScore(sourceType: KnowledgeSourceType): number {
  return AUTHORITY[sourceType];
}

export function deriveConfidence(record: KnowledgeRecord, independentMatches = 1, versionCompatible = false): { level: ConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [`${record.sourceType.replaceAll('_', ' ')} source`];
  let evidence = authorityScore(record.sourceType);
  if (record.status === 'verified') { evidence += 0.12; reasons.push('verified evidence'); }
  if (versionCompatible) { evidence += 0.08; reasons.push('runtime version compatible'); }
  if (independentMatches > 1) { evidence += Math.min(0.1, independentMatches * 0.025); reasons.push(`${independentMatches} matching records`); }
  if (record.status === 'deprecated' || record.status === 'failed') evidence -= 0.35;
  if (record.status === 'unverified') reasons.push('not execution-verified');
  const level: ConfidenceLevel = evidence >= 0.9 ? 'HIGH' : evidence >= 0.58 ? 'MEDIUM' : 'LOW';
  return { level, reasons };
}

export function sanitizeReferenceText(value: string): string {
  return value.replaceAll('\0', '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '[script removed]');
}
