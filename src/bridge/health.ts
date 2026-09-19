import { bridgeClient } from './client.js';
import { logger } from '../utils/logger.js';

export interface HealthCheckResult {
  online: boolean;
  latencyMs?: number;
  bridgeHost: string;
  bridgePort: number;
  cavalryVersion?: string;
  activeComp?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export async function checkBridgeHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const host = (bridgeClient as any).host || '127.0.0.1';
  const port = (bridgeClient as any).port || 8080;

  try {
    const res = await bridgeClient.send<any>('cavalry_health', {}, 3000);
    const latencyMs = Date.now() - startTime;

    return {
      online: true,
      latencyMs,
      bridgeHost: host,
      bridgePort: port,
      cavalryVersion: res.result?.cavalryVersion,
      activeComp: res.result?.activeComp,
      timestamp: new Date().toISOString(),
      details: res.result,
    };
  } catch (err: any) {
    return {
      online: false,
      bridgeHost: host,
      bridgePort: port,
      timestamp: new Date().toISOString(),
      details: { error: err.message, code: err.code },
    };
  }
}
