import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FilesystemSandbox } from '../../src/utils/filesystem.js';
import { CavalryError } from '../../src/mcp/errors.js';

describe('FilesystemSandbox', () => {
  const allowedRoot = path.join(os.tmpdir(), 'cavalry-test-sandbox');
  const sandbox = new FilesystemSandbox([allowedRoot]);

  it('allows access to files within the designated sandbox root', () => {
    const safeFile = path.join(allowedRoot, 'project.cv');
    assert.equal(sandbox.isPathAllowed(safeFile), true);
    assert.doesNotThrow(() => sandbox.assertAllowedPath(safeFile));
  });

  it('blocks path traversal attacks attempting to escape roots', () => {
    const maliciousPath = path.join(allowedRoot, '../../../../etc/passwd');
    assert.equal(sandbox.isPathAllowed(maliciousPath), false);
    assert.throws(
      () => sandbox.assertAllowedPath(maliciousPath),
      (err: any) => err instanceof CavalryError && err.code === 'FILE_NOT_ALLOWED',
    );
  });

  it('blocks unauthorized root paths', () => {
    const unauthorizedPath = '/private/etc/shadow';
    assert.equal(sandbox.isPathAllowed(unauthorizedPath), false);
    assert.throws(
      () => sandbox.assertAllowedPath(unauthorizedPath),
      (err: any) => err instanceof CavalryError && err.code === 'FILE_NOT_ALLOWED',
    );
  });

  it('blocks writes through a symlink that escapes an allowed root', () => {
    const allowed = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-allowed-'));
    const link = path.join(allowed, 'escape');
    fs.symlinkSync('/etc', link, 'dir');
    const sandbox = new FilesystemSandbox([allowed], path.join(allowed, 'previews'));

    assert.equal(sandbox.isPathAllowed(path.join(link, 'new.cv')), false);
  });
});
