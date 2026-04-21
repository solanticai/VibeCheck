import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePath } from '../utils/path.js';
import { createIgnoreMatcher, type IgnoreMatcher } from '../utils/ignore.js';

const ANALYZABLE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mts',
  'mjs',
  'py',
  'rb',
  'php',
  'go',
  'rs',
]);

export interface WalkedFile {
  path: string;
  content: string;
  extension: string;
  directory: string;
  filename: string;
}

export interface WalkOptions {
  rootDir: string;
  scanPaths?: string[];
  /**
   * Legacy per-walk ignore patterns (from `config.learn.ignorePaths`).
   * These are merged on top of `.vguardignore` + hardcoded defaults.
   * Prefer `.vguardignore` for new projects — see `vguard ignore`.
   */
  ignorePaths?: string[];
  maxFiles?: number;
}

/**
 * Walk a project directory and return analyzable source files.
 */
export function walkProject(options: WalkOptions): WalkedFile[] {
  const { rootDir, ignorePaths = [], maxFiles = 5000 } = options;
  const matcher = createIgnoreMatcher(rootDir, ignorePaths);
  const files: WalkedFile[] = [];
  const scanDirs = options.scanPaths?.map((p) => join(rootDir, p)) ?? [rootDir];

  for (const dir of scanDirs) {
    walkDir(dir, matcher, files, maxFiles);
    if (files.length >= maxFiles) break;
  }

  return files;
}

function walkDir(dir: string, matcher: IgnoreMatcher, files: WalkedFile[], maxFiles: number): void {
  if (files.length >= maxFiles) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    const fullPath = join(dir, entry);

    try {
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (matcher.isIgnored(fullPath + '/')) continue;
        walkDir(fullPath, matcher, files, maxFiles);
      } else if (stat.isFile()) {
        if (matcher.isIgnored(fullPath)) continue;
        const ext = entry.split('.').pop()?.toLowerCase() ?? '';
        if (!ANALYZABLE_EXTENSIONS.has(ext)) continue;
        if (stat.size > 500_000) continue; // Skip files > 500KB

        const content = readFileSync(fullPath, 'utf-8');
        const normalized = normalizePath(fullPath);
        const lastSlash = normalized.lastIndexOf('/');

        files.push({
          path: normalized,
          content,
          extension: ext,
          directory: lastSlash >= 0 ? normalized.slice(0, lastSlash) : '',
          filename: lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized,
        });
      }
    } catch {
      continue;
    }
  }
}
