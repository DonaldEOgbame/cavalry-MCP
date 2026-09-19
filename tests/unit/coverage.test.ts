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
});
