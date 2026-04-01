import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePath } from '../utils/path.js';

const DEFAULT_EXCLUDE = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'coverage',
  '.vibecheck',
  '__pycache__',
  '.venv',
  'vendor',
  '.turbo',
];

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
  ignorePaths?: string[];
  maxFiles?: number;
}

/**
 * Walk a project directory and return analyzable source files.
 */
export function walkProject(options: WalkOptions): WalkedFile[] {
  const { rootDir, ignorePaths = DEFAULT_EXCLUDE, maxFiles = 5000 } = options;
  const files: WalkedFile[] = [];
  const scanDirs = options.scanPaths?.map((p) => join(rootDir, p)) ?? [rootDir];

  for (const dir of scanDirs) {
    walkDir(dir, ignorePaths, files, maxFiles);
    if (files.length >= maxFiles) break;
  }

  return files;
}

function walkDir(dir: string, exclude: string[], files: WalkedFile[], maxFiles: number): void {
  if (files.length >= maxFiles) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    if (exclude.some((ex) => entry === ex || entry.startsWith('.'))) continue;

    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, exclude, files, maxFiles);
      } else if (stat.isFile()) {
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
