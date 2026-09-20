#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Preview from '../src/preview/frames.js';
import { bridgeClient } from '../src/bridge/client.js';
import { knowledgeEngine } from '../src/knowledge/engine.js';
import { CORE_RECIPES } from '../src/knowledge/recipes.js';
import { contentHash, stableId } from '../src/knowledge/provenance.js';

const PROJECT_ID = 'cavalry-2.7.2-golden-corpus';
const ROOT = resolve('knowledge/verified/golden-corpus');

const sceneByRecipe: Record<string, string> = {
  'word-rise-stagger': '04-word-rise-stagger',
  'character-cascade': '05-character-cascade',
  'mask-line-reveal': '22-mask-line-reveal',
  'radial-duplication-wave': '06-radial-duplication-wave',
  'grid-duplication-wave': '07-grid-duplication-wave',
  'orbit-loop': '23-orbit-loop',
  'shape-scale-pop': '01-basic-transform-keyframes',
  'procedural-burst': '24-procedural-burst',
  'directional-wipe-transition': '19-directional-wipe',
  'logo-geometric-assembly': '20-logo-geometric-assembly',
  'progress-indicator': '21-progress-indicator',
  'repeated-data-cards': '18-repeated-data-cards',
};

async function hashFile(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function validate(recipeName: string) {
  const recipe = CORE_RECIPES.find((item) => item.name === recipeName);
  assert.ok(recipe, `Unknown recipe ${recipeName}`);
  const slug = sceneByRecipe[recipeName];
  assert.ok(slug, `No golden scene mapped for ${recipeName}`);
  const directory = resolve(ROOT, slug);
  const scenePath = resolve(directory, `${slug}.cv`);
  const inspectionPath = resolve(directory, `${slug}.inspection.json`);
  const inspection = JSON.parse(await readFile(inspectionPath, 'utf8'));

  await Scene.sceneOpen(scenePath, true);
  const outputDir = resolve(directory, 'recipe-validation');
  await mkdir(outputDir, { recursive: true });
  const frames = [0, 15, 30, 45, 60];
  const rendered: string[] = [];
  for (const frame of frames) {
    const target = resolve(outputDir, `frame-${String(frame).padStart(3, '0')}.png`);
    const result = await Preview.previewFrame(frame, 50, target);
    await stat(result.filePath);
    rendered.push(result.filePath);
  }
  const hashes = await Promise.all(rendered.map(hashFile));
  assert.ok(new Set(hashes).size >= 2, `${recipeName} produced no visible motion across validation frames`);
  assert.ok(inspection.layers.length > 0, `${recipeName} has no extracted graph nodes`);
  assert.ok(inspection.connections.length > 0, `${recipeName} has no extracted graph connections`);

  const builtinId = stableId('motion_recipe', `builtin:recipes/${recipe.name}`, recipe.category);
  const existing = await knowledgeEngine.store.get(builtinId);
  assert.ok(existing, `Missing built-in recipe record ${recipe.name}`);
  existing.status = 'verified';
  existing.updatedAt = new Date().toISOString();
  existing.tags = [...new Set([...existing.tags, 'live-validated', 'render-verified'])];
  existing.provenance.contentHash = contentHash(`${existing.content}\nlive-validation:${slug}:${hashes.join(':')}`);
  await knowledgeEngine.store.upsert(existing);
  await knowledgeEngine.store.save();

  await knowledgeEngine.addVisualOutcome({
    intent: `Live validation of recipe ${recipe.name}`,
    recipeUsed: recipe.name,
    sceneFingerprint: inspection.rawSnapshot ? undefined : inspection.scene?.graph?.fingerprint,
    previewFrames: rendered,
    timing: { frames, fps: inspection.composition.fps },
    attributes: { scene: slug, uniqueRenderedFrames: new Set(hashes).size },
    notes: ['Built in Cavalry 2.7.2, extracted from the saved scene, and checked across five rendered frames.'],
    qaPassed: true,
  }, 'project', PROJECT_ID, undefined, '2.7.2');

  const result = { recipe: recipe.name, scene: slug, status: 'VERIFIED', frames: rendered, uniqueRenderedFrames: new Set(hashes).size };
  await writeFile(resolve(outputDir, 'validation.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main() {
  const recipeArg = process.argv.find((arg) => arg.startsWith('--recipe='));
  const indexArg = process.argv.find((arg) => arg.startsWith('--index='));
  const recipe = recipeArg?.split('=')[1] ?? CORE_RECIPES[Number(indexArg?.split('=')[1] ?? 0) - 1]?.name;
  if (!recipe) {
    process.stdout.write(`${JSON.stringify(CORE_RECIPES.map((item, index) => ({ index: index + 1, recipe: item.name, scene: sceneByRecipe[item.name] })), null, 2)}\n`);
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(await validate(recipe), null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await knowledgeEngine.addFailure({
        intent: `Validate recipe ${recipe} in live Cavalry`,
        approach: 'Open the verified golden scene and render five timing checkpoints.',
        mcpOperation: 'preview_frame',
        error: message,
        category: 'LIVE_RECIPE_VALIDATION',
        solution: 'Keep the recipe UNVERIFIED until its scene or timing is corrected and rerun.',
      }, 'project', PROJECT_ID, '2.7.2');
    } catch {}
    throw error;
  } finally {
    bridgeClient.stopCallbackServer();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
