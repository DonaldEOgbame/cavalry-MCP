import { CavalryError } from './errors.js';

export type SecurityTier = 'SAFE' | 'EXTENDED' | 'RAW' | 'SYSTEM_EXEC';

export interface PermissionManagerConfig {
  tier?: SecurityTier;
  allowRawScript?: boolean;
  allowSystemExec?: boolean;
}

export class PermissionManager {
  private tier: SecurityTier = 'SAFE';
  private allowRawScript: boolean = false;
  private allowSystemExec: boolean = false;

  constructor(config?: PermissionManagerConfig) {
    const envTier = process.env.CAVALRY_SECURITY_TIER?.toUpperCase();
    if (envTier === 'EXTENDED' || envTier === 'RAW' || envTier === 'SYSTEM_EXEC' || envTier === 'SAFE') {
      this.tier = envTier as SecurityTier;
    }
    if (config?.tier) {
      this.tier = config.tier;
    }

    this.allowRawScript =
      process.env.CAVALRY_ALLOW_RAW_SCRIPT === 'true' ||
      config?.allowRawScript === true ||
      this.tier === 'RAW';

    this.allowSystemExec =
      process.env.CAVALRY_ALLOW_SYSTEM_EXEC === 'true' ||
      config?.allowSystemExec === true ||
      this.tier === 'SYSTEM_EXEC';
  }

  getTier(): SecurityTier {
    return this.tier;
  }

  isRawScriptAllowed(): boolean {
    return this.allowRawScript;
  }

  isSystemExecAllowed(): boolean {
    return this.allowSystemExec;
  }

  assertRawScript(operation: string = 'cavalry_raw_script') {
    if (!this.allowRawScript) {
      throw new CavalryError({
        code: 'RAW_SCRIPT_DISABLED',
        message: 'Raw Cavalry scripting is disabled by default.',
        operation,
        suggestion: 'Enable by setting CAVALRY_ALLOW_RAW_SCRIPT=true in your environment configuration.',
      });
    }
  }

  assertSystemExec(operation: string = 'system_exec') {
    if (!this.allowSystemExec) {
      throw new CavalryError({
        code: 'SYSTEM_EXEC_DISABLED',
        message: 'Direct operating-system process execution is disabled.',
        operation,
        suggestion: 'This safety boundary protects your host environment from unauthorized process spawns.',
      });
    }
  }
}

export const permissions = new PermissionManager();
