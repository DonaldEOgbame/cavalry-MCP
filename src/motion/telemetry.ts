import { MotionTelemetry } from './types.js';

const metrics = new Map<string, MotionTelemetry>();

export function telemetryFor(projectId: string): MotionTelemetry {
  let value = metrics.get(projectId);
  if (!value) {
    value = {
      projectId,
      highLevelCallCount: 0,
      bridgeOperationCount: 0,
      batchCount: 0,
      averageBatchSize: 0,
      planningMs: 0,
      compilationMs: 0,
      cavalryExecutionMs: 0,
      validationMs: 0,
      renderMs: 0,
      qcMs: 0,
      correctionMs: 0,
      totalServerMs: 0,
      modelReasoningMs: null,
      notes: ['Model reasoning time is client-side and cannot be measured by the MCP server.'],
    };
    metrics.set(projectId, value);
  }
  return value;
}

export function recordCall(projectId: string, serverMs: number): void {
  const value = telemetryFor(projectId);
  value.highLevelCallCount += 1;
  value.totalServerMs += serverMs;
}

export function recordBatches(projectId: string, sizes: number[], elapsedMs: number): void {
  const value = telemetryFor(projectId);
  value.batchCount += sizes.length;
  value.bridgeOperationCount += sizes.reduce((sum, size) => sum + size, 0);
  value.cavalryExecutionMs += elapsedMs;
  value.averageBatchSize = value.batchCount ? value.bridgeOperationCount / value.batchCount : 0;
}

export function addTiming(projectId: string, field: 'planningMs' | 'compilationMs' | 'validationMs' | 'renderMs' | 'qcMs' | 'correctionMs', elapsedMs: number): void {
  telemetryFor(projectId)[field] += elapsedMs;
}

export function resetTelemetry(projectId: string): void {
  metrics.delete(projectId);
}

