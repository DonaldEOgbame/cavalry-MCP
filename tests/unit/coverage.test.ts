import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

describe('parity coverage records', () => {
  it('contains no unknown capability classifications', async () => {
    const data = JSON.parse(await readFile(resolve('coverage/cavalry-capabilities.json'), 'utf8'));
    const unknown = Object.entries(data.capabilities).filter(([, value]: any) => value.coverage === 'UNKNOWN');
    assert.deepEqual(unknown, []);
  });

  it('accounts for every discovered public API method', async () => {
    const data = JSON.parse(await readFile(resolve('coverage/cavalry-api-manifest.json'), 'utf8'));
    assert.equal(data.methods.length, data.discovered);
    assert.equal(data.unexplained, 0);
    assert.ok(data.methods.every((entry: any) => entry.rationale && entry.status !== 'missing'));
  });

  it('maps every declared render format to an installed Cavalry node type', async (context) => {
    const definitionsPath = '/Applications/Cavalry.app/Contents/assets/Definitions/nodeDefinitions.json';
    if (!existsSync(definitionsPath)) {
      context.skip('Cavalry node definitions are not installed on this host');
      return;
    }
    const matrix = JSON.parse(await readFile(resolve('coverage/render-formats.json'), 'utf8'));
    const definitions = JSON.parse(await readFile(definitionsPath, 'utf8'));
    const nodeTypes = new Set(definitions.map((entry: any) => entry.nodeType));
    const missing = Object.entries(matrix.formats)
      .filter(([, value]: any) => !nodeTypes.has(value.nodeType))
      .map(([name, value]: any) => `${name}:${value.nodeType}`);
    assert.deepEqual(missing, []);
  });

  it('accounts for every concrete node type in the Cavalry schema (nodeDefinitions.json)', async (context) => {
    const path = resolve('coverage/cavalry-node-definition-coverage.json');
    if (!existsSync(path)) {
      context.skip('Node-definition coverage has not been generated on this host (run npm run coverage:node-definitions)');
      return;
    }
    const data = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(data.unknownCount, 0);
    assert.equal(data.verifiedLiveFalseCount, 0);
    assert.equal(data.nodes.length, data.concreteNodeTypes);
    assert.ok(data.nodes.every((entry: any) => entry.coverage !== 'UNKNOWN'));
  });

  it('reconciles every Cavalry runtime surface with zero unknowns', async (context) => {
    const path = resolve('coverage/cavalry-surface-audit.json');
    if (!existsSync(path)) {
      context.skip('Cross-surface audit has not been generated on this host (run npm run coverage:surface-audit)');
      return;
    }
    const data = JSON.parse(await readFile(path, 'utf8'));
    const inventory = JSON.parse(await readFile(resolve('coverage/mcp-tool-inventory.json'), 'utf8'));
    assert.equal(data.counts.unknown, 0);
    assert.equal(data.counts.mcpTools, inventory.count);
    assert.equal(inventory.tools.length, inventory.count);
    assert.equal(data.counts.capabilityGroups, 62);
    assert.equal(data.counts.concreteNodeTypes, 436);
    assert.equal(data.counts.nodeAttributes, 3168);
    assert.ok(data.capabilityGroups.every((entry: any) => entry.coverage !== 'UNKNOWN' && entry.missingTools.length === 0));
    assert.ok(data.apiSurface.every((entry: any) => entry.coverage !== 'UNKNOWN'));
  });

  it('leaves no render format with an unexplained live-verification gap', async (context) => {
    const matrix = JSON.parse(await readFile(resolve('coverage/render-formats.json'), 'utf8'));
    const entries = Object.entries(matrix.formats) as [string, any][];
    if (!entries.some(([, v]) => 'liveStatus' in v)) {
      context.skip('Render formats have not been live-swept on this host (run npm run coverage:render-sweep)');
      return;
    }
    const unexplained = entries.filter(([, v]) => {
      if (v.liveStatus === 'PASS') return false;
      if (v.liveStatus === 'KNOWN_LIMITATION') return typeof v.liveNotes !== 'string' || v.liveNotes.length === 0;
      return true; // FAIL or NOT_SWEPT both count as unexplained
    });
    assert.deepEqual(unexplained.map(([name]) => name), []);
  });
});
