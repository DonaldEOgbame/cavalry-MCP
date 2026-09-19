import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { CavalryError } from '../mcp/errors.js';

export class FilesystemSandbox {
  private allowedRoots: string[] = [];
  private previewDir: string;

  constructor(customRoots?: string[], customPreviewDir?: string) {
    const cwd = process.cwd();
    const tempDir = os.tmpdir();
    const previewDir = customPreviewDir || process.env.CAVALRY_PREVIEW_DIR || path.join(tempDir, 'cavalry-previews');

    try {
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }
    } catch {
      // Ignore if cannot create preview dir upfront
    }

    this.previewDir = path.resolve(previewDir);

    const roots: string[] = [
      cwd,
      tempDir,
      this.previewDir,
    ];

    const envRoots = process.env.CAVALRY_ALLOWED_ROOTS;
    if (envRoots) {
      envRoots.split(',').map(r => r.trim()).filter(Boolean).forEach(r => roots.push(r));
    }

    if (customRoots) {
      roots.push(...customRoots);
    }

    this.allowedRoots = roots.map(r => {
      try {
        return fs.existsSync(r) ? fs.realpathSync(path.resolve(r)) : path.resolve(r);
      } catch {
        return path.resolve(r);
      }
    });
  }

  getPreviewDir(): string {
    return this.previewDir;
  }

  getAllowedRoots(): string[] {
    return [...this.allowedRoots];
  }

  addAllowedRoot(rootPath: string) {
    const canonical = path.resolve(rootPath);
    if (!this.allowedRoots.includes(canonical)) {
      this.allowedRoots.push(canonical);
    }
  }

  isPathAllowed(targetPath: string): boolean {
    try {
      const resolved = path.resolve(targetPath);
      let existingAncestor = resolved;
      while (!fs.existsSync(existingAncestor)) {
        const parent = path.dirname(existingAncestor);
        if (parent === existingAncestor) return false;
        existingAncestor = parent;
      }
      const canonicalAncestor = fs.realpathSync(existingAncestor);
      const canonical = path.join(canonicalAncestor, path.relative(existingAncestor, resolved));

      return this.allowedRoots.some(root => {
        const relative = path.relative(root, canonical);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
      });
    } catch {
      return false;
    }
  }

  assertAllowedPath(targetPath: string, operation: string = 'filesystem'): string {
    if (!this.isPathAllowed(targetPath)) {
      throw new CavalryError({
        code: 'FILE_NOT_ALLOWED',
        message: `Access to filesystem path '${targetPath}' is outside the authorized sandbox roots.`,
        operation,
        suggestion: `Allowed roots are: ${this.allowedRoots.join(', ')}. Set CAVALRY_ALLOWED_ROOTS to permit additional directories.`,
      });
    }
    return path.resolve(targetPath);
  }
}

export const filesystem = new FilesystemSandbox();
