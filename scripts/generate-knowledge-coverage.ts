#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { knowledgeEngine } from '../src/knowledge/engine.js';

const [status, audit] = await Promise.all([knowledgeEngine.status(), knowledgeEngine.audit()]);
const records = await knowledgeEngine.store.all();
const verifiedByType: Record<string, number> = {};
for (const record of records) if (record.status === 'verified') verifiedByType[record.sourceType] = (verifiedByType[record.sourceType] ?? 0) + 1;
const requiredTypes = ['official_api', 'official_docs', 'real_scene', 'motion_recipe', 'verified_script', 'component', 'failure', 'visual_outcome'];
const gaps = requiredTypes.filter((type) => !(verifiedByType[type] > 0));
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cavalryVersion: '2.7.2',
  status,
  verifiedByType,
  requiredTypes,
  gaps,
  healthy: gaps.length === 0 && audit.duplicateRate === 0 && audit.missingProvenance.length === 0 && audit.failedParsing.length === 0,
  coverage: audit.coverage,
  audit: {
    duplicateRate: audit.duplicateRate,
    orphanedRecords: audit.orphanedRecords,
    missingProvenance: audit.missingProvenance,
    missingMetadata: audit.missingMetadata,
    staleDocumentation: audit.staleDocumentation,
    failedParsing: audit.failedParsing,
  },
};
await mkdir(resolve('knowledge/generated'), { recursive: true });
await writeFile(resolve('knowledge/generated/knowledge-coverage-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ healthy: report.healthy, verifiedByType, gaps }, null, 2)}\n`);
if (!report.healthy) process.exitCode = 1;
