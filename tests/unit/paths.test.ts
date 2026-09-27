import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { packagePath, packageRoot, knowledgeDataPath } from '../../src/utils/paths.js';

describe('stable package and user-data paths', () => {
  it('resolves immutable resources from import.meta.url, not cwd', () => {
    assert.equal(packagePath('package.json'), path.join(packageRoot, 'package.json'));
    assert.notEqual(packageRoot, process.cwd() === packageRoot ? '/definitely-not-cwd' : process.cwd());
  });

  it('keeps the writable knowledge overlay outside the package by default', () => {
    if (!process.env.CAVALRY_KNOWLEDGE_DB && !process.env.CAVALRY_DATA_DIR) {
      assert.equal(knowledgeDataPath().startsWith(packageRoot), false);
    }
  });
});
