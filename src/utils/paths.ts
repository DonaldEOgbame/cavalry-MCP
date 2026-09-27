import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Package root in both source (`src/utils`) and compiled (`dist/utils`) layouts. */
export const packageRoot = path.resolve(moduleDirectory, '..', '..');

export function packagePath(...segments: string[]): string {
  return path.join(packageRoot, ...segments);
}

export function userDataDirectory(): string {
  if (process.env.CAVALRY_DATA_DIR) return path.resolve(process.env.CAVALRY_DATA_DIR);
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'cavalry-mcp');
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'cavalry-mcp');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'cavalry-mcp');
}

export function knowledgeDataPath(): string {
  return process.env.CAVALRY_KNOWLEDGE_DB
    ? path.resolve(process.env.CAVALRY_KNOWLEDGE_DB)
    : path.join(userDataDirectory(), 'knowledge', 'knowledge-index.json');
}

export function knowledgeSeedPath(): string {
  return process.env.CAVALRY_KNOWLEDGE_SEED
    ? path.resolve(process.env.CAVALRY_KNOWLEDGE_SEED)
    : packagePath('knowledge', 'generated', 'knowledge-index.json');
}

