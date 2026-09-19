import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionManager } from '../../src/mcp/permissions.js';
import { CavalryError } from '../../src/mcp/errors.js';

describe('PermissionManager', () => {
  it('defaults to SAFE mode with raw scripting and system exec disabled', () => {
    const pm = new PermissionManager({ tier: 'SAFE', allowRawScript: false, allowSystemExec: false });
    assert.equal(pm.getTier(), 'SAFE');
    assert.equal(pm.isRawScriptAllowed(), false);
    assert.equal(pm.isSystemExecAllowed(), false);
    assert.throws(() => pm.assertRawScript(), (err: any) => err instanceof CavalryError && err.code === 'RAW_SCRIPT_DISABLED');
    assert.throws(() => pm.assertSystemExec(), (err: any) => err instanceof CavalryError && err.code === 'SYSTEM_EXEC_DISABLED');
  });

  it('allows raw scripting when explicitly enabled', () => {
    const pm = new PermissionManager({ allowRawScript: true });
    assert.equal(pm.isRawScriptAllowed(), true);
    assert.doesNotThrow(() => pm.assertRawScript());
  });

  it('allows system exec when explicitly enabled', () => {
    const pm = new PermissionManager({ allowSystemExec: true });
    assert.equal(pm.isSystemExecAllowed(), true);
    assert.doesNotThrow(() => pm.assertSystemExec());
  });
});
