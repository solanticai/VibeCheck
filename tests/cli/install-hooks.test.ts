import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installHooksCommand } from '../../src/cli/commands/install-hooks.js';

const MANAGED_MARKER = '# vguard-managed-hook';

describe('installHooksCommand', () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'vguard-hooks-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    }) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    cwdSpy.mockRestore();
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('skips cleanly when .git is absent', async () => {
    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');
    expect(existsSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'))).toBe(false);
  });

  it('installs pre-commit and commit-msg when .git exists', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');

    const precommit = readFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), 'utf8');
    const commitmsg = readFileSync(join(tmpRoot, '.git', 'hooks', 'commit-msg'), 'utf8');

    expect(precommit).toContain(MANAGED_MARKER);
    expect(precommit).toContain('_run-git-hook git:pre-commit');
    expect(commitmsg).toContain(MANAGED_MARKER);
    expect(commitmsg).toContain('_run-git-hook git:commit-msg');
  });

  it('is idempotent — second run overwrites managed hooks only', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');
    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');
    const precommit = readFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(precommit).toContain(MANAGED_MARKER);
  });

  it('does not overwrite non-managed existing hook without --force', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    const customHook = '#!/bin/sh\necho "my custom hook"\n';
    writeFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), customHook);

    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');

    const preserved = readFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(preserved).toBe(customHook);
  });

  it('overwrites non-managed hook with --force', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho old\n');

    await expect(installHooksCommand({ silent: true, force: true })).rejects.toThrow(
      'process.exit(0)',
    );

    const replaced = readFileSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(replaced).toContain(MANAGED_MARKER);
  });

  it('--uninstall removes only managed hooks', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');

    // Add a foreign hook that should survive
    writeFileSync(join(tmpRoot, '.git', 'hooks', 'post-commit'), '#!/bin/sh\necho foreign\n');

    await expect(installHooksCommand({ silent: true, uninstall: true })).rejects.toThrow(
      'process.exit(0)',
    );

    expect(existsSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'))).toBe(false);
    expect(existsSync(join(tmpRoot, '.git', 'hooks', 'commit-msg'))).toBe(false);
    expect(existsSync(join(tmpRoot, '.git', 'hooks', 'post-commit'))).toBe(true);
  });

  it('respects VGUARD_NO_INSTALL_HOOKS=1', async () => {
    mkdirSync(join(tmpRoot, '.git', 'hooks'), { recursive: true });
    const prev = process.env.VGUARD_NO_INSTALL_HOOKS;
    process.env.VGUARD_NO_INSTALL_HOOKS = '1';
    try {
      await expect(installHooksCommand({ silent: true })).rejects.toThrow('process.exit(0)');
      expect(existsSync(join(tmpRoot, '.git', 'hooks', 'pre-commit'))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.VGUARD_NO_INSTALL_HOOKS;
      else process.env.VGUARD_NO_INSTALL_HOOKS = prev;
    }
  });
});
