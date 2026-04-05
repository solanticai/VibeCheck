import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ignoreListCommand,
  ignoreAddCommand,
  ignoreRemoveCommand,
  ignoreCheckCommand,
  ignoreInitCommand,
} from '../../src/cli/commands/ignore.js';
import { clearIgnoreMatcherCache } from '../../src/utils/ignore.js';

const IGNORE_FILE = '.vguardignore';

let projectRoot: string;
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'vguard-ignore-cmd-'));
  originalCwd = process.cwd();
  process.chdir(projectRoot);
  clearIgnoreMatcherCache();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('exit');
  }) as never);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  process.chdir(originalCwd);
  clearIgnoreMatcherCache();
  rmSync(projectRoot, { recursive: true, force: true });
});

function readIgnoreFile(): string {
  return readFileSync(join(projectRoot, IGNORE_FILE), 'utf-8');
}

describe('vguard ignore init', () => {
  it('creates .vguardignore with default template', async () => {
    await ignoreInitCommand();
    expect(existsSync(join(projectRoot, IGNORE_FILE))).toBe(true);
    const content = readIgnoreFile();
    expect(content).toContain('# VGuard ignore');
    expect(content).toContain('.DS_Store');
  });

  it('does not overwrite an existing file', async () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), 'custom-content\n', 'utf-8');
    await ignoreInitCommand();
    expect(readIgnoreFile()).toBe('custom-content\n');
  });
});

describe('vguard ignore add', () => {
  it('creates .vguardignore if missing and appends the pattern', async () => {
    await ignoreAddCommand('src/components/ui/');
    const content = readIgnoreFile();
    expect(content).toContain('src/components/ui/');
    expect(content).toContain('# VGuard ignore'); // template header
  });

  it('appends to existing .vguardignore', async () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), '# header\nexisting/\n', 'utf-8');
    await ignoreAddCommand('another/');
    const content = readIgnoreFile();
    expect(content).toContain('existing/');
    expect(content).toContain('another/');
  });

  it('refuses duplicates (no write, no error)', async () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), 'already-here/\n', 'utf-8');
    await ignoreAddCommand('already-here/');
    const content = readIgnoreFile();
    // Should still contain exactly one occurrence.
    expect(content.match(/already-here\//g)).toHaveLength(1);
  });

  it('rejects empty patterns', async () => {
    await expect(ignoreAddCommand('   ')).rejects.toThrow('exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('empty'));
  });

  it('rejects comment-only patterns', async () => {
    await expect(ignoreAddCommand('# nope')).rejects.toThrow('exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('comment'));
  });
});

describe('vguard ignore remove', () => {
  it('removes an exact matching line', async () => {
    writeFileSync(
      join(projectRoot, IGNORE_FILE),
      '# header\nkeep-me/\nremove-me/\nalso-keep/\n',
      'utf-8',
    );
    await ignoreRemoveCommand('remove-me/');
    const content = readIgnoreFile();
    expect(content).toContain('keep-me/');
    expect(content).toContain('also-keep/');
    expect(content).toContain('# header');
    expect(content).not.toContain('remove-me/');
  });

  it('no-ops when pattern is not present', async () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), 'a/\nb/\n', 'utf-8');
    await ignoreRemoveCommand('nonexistent/');
    const content = readIgnoreFile();
    expect(content).toBe('a/\nb/\n');
  });

  it('no-ops when file does not exist', async () => {
    await ignoreRemoveCommand('anything/');
    expect(existsSync(join(projectRoot, IGNORE_FILE))).toBe(false);
  });

  it('rejects empty patterns', async () => {
    await expect(ignoreRemoveCommand('  ')).rejects.toThrow('exit');
  });
});

describe('vguard ignore list', () => {
  it('prints defaults and file patterns', () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), 'src/components/ui/\n*.log\n', 'utf-8');
    ignoreListCommand();

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[default]');
    expect(output).toContain('node_modules/');
    expect(output).toContain('.vguardignore');
    expect(output).toContain('src/components/ui/');
    expect(output).toContain('*.log');
  });

  it('reports when no .vguardignore exists', () => {
    ignoreListCommand();
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('(not found)');
    expect(output).toContain('vguard ignore init');
  });
});

describe('vguard ignore check', () => {
  it('reports a default-matched path as ignored', () => {
    ignoreCheckCommand('node_modules/foo/index.js');
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('ignored');
    expect(output).toContain('built-in default');
  });

  it('reports a .vguardignore-matched path as ignored', () => {
    writeFileSync(join(projectRoot, IGNORE_FILE), 'src/components/ui/\n', 'utf-8');
    clearIgnoreMatcherCache();
    ignoreCheckCommand('src/components/ui/button.tsx');
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('ignored');
    expect(output).toContain('.vguardignore');
  });

  it('reports a non-matching path as included', () => {
    ignoreCheckCommand('src/app/page.tsx');
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('included');
    expect(output).toContain('no pattern matched');
  });

  it('rejects empty path', () => {
    expect(() => ignoreCheckCommand('')).toThrow('exit');
  });
});
