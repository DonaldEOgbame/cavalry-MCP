import { AsyncLocalStorage } from 'node:async_hooks';

/** Identifies the MCP tool call on whose behalf bridge requests are sent. */
export interface ToolCallContext {
  callId: string;
  tool: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<ToolCallContext>();

export function runInToolContext<T>(context: ToolCallContext, operation: () => Promise<T>): Promise<T> {
  return storage.run(context, operation);
}

export function currentToolContext(): ToolCallContext | undefined {
  return storage.getStore();
}
