#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { knowledgeEngine } from './engine.js';
import { ComponentKnowledge, FailureKnowledge, MotionRecipe, ScriptKnowledge } from './types.js';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function jsonFiles(target: string): Promise<string[]> {
  const path = resolve(target);
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && extname(entry.name) === '.json').map((entry) => resolve(path, entry.name));
  } catch { return [path]; }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'status';
  const target = argument('path');
  const version = argument('version') ?? '2.7.2';
  let result: unknown;

  if (command === 'bootstrap') result = await knowledgeEngine.bootstrapRecipes();
  else if (command === 'ingest-docs') {
    if (!target) throw new Error('ingest-docs requires --path=/absolute/or/relative/directory');
    result = await knowledgeEngine.ingestion.ingestDirectory(target, { sourceType: 'official_docs', verified: true, cavalryVersion: version });
  } else if (command === 'ingest-api') {
    result = await knowledgeEngine.ingestion.ingestApiFile(target ?? resolve('coverage/cavalry-api-manifest.json'), { cavalryVersion: version });
  } else if (command === 'ingest-scenes') {
    if (!target) throw new Error('ingest-scenes requires --path to JSON scene inspections. Raw .cv parsing is deliberately refused.');
    const summaries = [];
    for (const file of await jsonFiles(target)) summaries.push(await knowledgeEngine.ingestion.ingestSceneSnapshotFile(file, { scope: 'project', projectId: argument('project') ?? basename(resolve(target)), cavalryVersion: version }));
    result = summaries;
  } else if (command === 'ingest-scripts') {
    if (!target) throw new Error('ingest-scripts requires --path to a ScriptKnowledge JSON file or directory');
    const summaries = [];
    for (const file of await jsonFiles(target)) summaries.push(await knowledgeEngine.ingestion.ingestScript(JSON.parse(await readFile(file, 'utf8')) as ScriptKnowledge, { scope: 'project', projectId: argument('project') ?? basename(resolve(target)), cavalryVersion: version, source: resolve(file) }));
    result = summaries;
  } else if (command === 'ingest-recipes') {
    if (!target) throw new Error('ingest-recipes requires --path to a MotionRecipe JSON file or directory');
    const summaries = [];
    for (const file of await jsonFiles(target)) summaries.push(await knowledgeEngine.ingestion.ingestRecipe(JSON.parse(await readFile(file, 'utf8')) as MotionRecipe, { cavalryVersion: version, source: resolve(file) }));
    result = summaries;
  } else if (command === 'ingest-failures') {
    if (!target) throw new Error('ingest-failures requires --path to a FailureKnowledge JSON file or directory');
    const summaries = [];
    for (const file of await jsonFiles(target)) summaries.push(await knowledgeEngine.ingestion.ingestFailure(JSON.parse(await readFile(file, 'utf8')) as FailureKnowledge, { scope: 'project', projectId: argument('project') ?? basename(resolve(target)), cavalryVersion: version, source: resolve(file) }));
    result = summaries;
  } else if (command === 'ingest-components') {
    if (!target) throw new Error('ingest-components requires --path to a ComponentKnowledge JSON file or directory');
    const summaries = [];
    for (const file of await jsonFiles(target)) summaries.push(await knowledgeEngine.ingestion.ingestComponent(JSON.parse(await readFile(file, 'utf8')) as ComponentKnowledge, { scope: 'project', projectId: argument('project') ?? basename(resolve(target)), cavalryVersion: version, source: resolve(file) }));
    result = summaries;
  } else if (command === 'reindex') result = { recipes: await knowledgeEngine.bootstrapRecipes(), sources: await knowledgeEngine.refresh() };
  else if (command === 'status') result = await knowledgeEngine.status();
  else if (command === 'verify' || command === 'audit') result = await knowledgeEngine.audit();
  else throw new Error(`Unknown knowledge command: ${command}`);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
