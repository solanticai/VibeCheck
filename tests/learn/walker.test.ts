import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';

// Build paths using native join so keys match on Windows and Linux
const ROOT = join('/project');

vi.mock('node:fs', async () => {
  const { join: pathJoin } = await import('node:path');

  const root = pathJoin('/project');
  const src = pathJoin('/project', 'src');
  const indexTs = pathJoin('/project', 'src', 'index.ts');
  const appTsx = pathJoin('/project', 'src', 'app.tsx');
  const utilsJs = pathJoin('/project', 'src', 'utils.js');
  const nodeModules = pathJoin('/project', 'node_modules');
  const dist = pathJoin('/project', 'dist');
  const readme = pathJoin('/project', 'README.md');
  const image = pathJoin('/project', 'image.png');
  const symlinkFile = pathJoin('/project', 'src', 'spicy.ts');
  const symlinkDir = pathJoin('/project', 'linked-dir');

  const files: Record<
    string,
    { content: string; isDir: boolean; isSymlink: boolean; size: number }
  > = {
    [root]: { content: '', isDir: true, isSymlink: false, size: 0 },
    [src]: { content: '', isDir: true, isSymlink: false, size: 0 },
    [indexTs]: { content: 'export const x = 1;', isDir: false, isSymlink: false, size: 20 },
    [appTsx]: { content: '<App />', isDir: false, isSymlink: false, size: 10 },
    [utilsJs]: { content: 'module.exports = {};', isDir: false, isSymlink: false, size: 25 },
    [nodeModules]: { content: '', isDir: true, isSymlink: false, size: 0 },
    [dist]: { content: '', isDir: true, isSymlink: false, size: 0 },
    [readme]: { content: '# README', isDir: false, isSymlink: false, size: 10 },
    [image]: { content: '', isDir: false, isSymlink: false, size: 100 },
    [symlinkFile]: { content: 'SECRET', isDir: false, isSymlink: true, size: 20 },
    [symlinkDir]: { content: '', isDir: true, isSymlink: true, size: 0 },
  };

  const dirEntries: Record<string, string[]> = {
    [root]: ['src', 'node_modules', 'dist', 'README.md', 'image.png', 'linked-dir'],
    [src]: ['index.ts', 'app.tsx', 'utils.js', 'spicy.ts'],
  };

  return {
    readdirSync: vi.fn((dir: string) => {
      return dirEntries[dir] ?? [];
    }),
    lstatSync: vi.fn((path: string) => {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: ${path}`);
      return {
        isDirectory: () => entry.isDir,
        isFile: () => !entry.isDir,
        isSymbolicLink: () => entry.isSymlink,
        size: entry.size,
      };
    }),
    readFileSync: vi.fn((path: string) => {
      const entry = files[path as string];
      if (!entry || entry.isDir) throw new Error(`ENOENT: ${path}`);
      return entry.content;
    }),
  };
});

import { walkProject } from '../../src/learn/walker.js';

describe('File System Walker', () => {
  it('walks project directory tree', () => {
    const files = walkProject({ rootDir: ROOT });
    expect(files.length).toBeGreaterThan(0);
  });

  it('skips node_modules and dist', () => {
    const files = walkProject({ rootDir: ROOT });
    const paths = files.map((f) => f.path);
    expect(paths.every((p) => !p.includes('node_modules'))).toBe(true);
    expect(paths.every((p) => !p.includes('dist'))).toBe(true);
  });

  it('returns only analyzable extensions', () => {
    const files = walkProject({ rootDir: ROOT });
    const extensions = files.map((f) => f.extension);
    // Should include ts, tsx, js but not md, png
    expect(extensions.every((e) => ['ts', 'tsx', 'js'].includes(e))).toBe(true);
  });

  it('includes file content', () => {
    const files = walkProject({ rootDir: ROOT });
    const tsFile = files.find((f) => f.filename === 'index.ts');
    expect(tsFile).toBeDefined();
    expect(tsFile!.content).toContain('export const x');
  });

  it('respects maxFiles limit', () => {
    const files = walkProject({ rootDir: ROOT, maxFiles: 1 });
    expect(files.length).toBeLessThanOrEqual(1);
  });

  it('includes directory and filename metadata', () => {
    const files = walkProject({ rootDir: ROOT });
    for (const file of files) {
      expect(file.filename).toBeTruthy();
      expect(file.directory).toBeTruthy();
      expect(file.path).toBeTruthy();
    }
  });

  it('skips symbolic links (files and directories)', () => {
    const files = walkProject({ rootDir: ROOT });
    const paths = files.map((f) => f.path);
    expect(paths.every((p) => !p.includes('spicy.ts'))).toBe(true);
    expect(paths.every((p) => !p.includes('linked-dir'))).toBe(true);
  });
});
