import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

const LOCKFILE_MAP: Record<string, { lockfiles: string[]; safeFlag: RegExp }> = {
  npm: {
    lockfiles: ['package-lock.json'],
    safeFlag: /\b(?:ci\b|--package-lock-only|--from-lockfile)\b/,
  },
  pnpm: {
    lockfiles: ['pnpm-lock.yaml'],
    safeFlag: /\b(?:install|i)\s+--frozen-lockfile\b/,
  },
  yarn: {
    lockfiles: ['yarn.lock'],
    safeFlag: /\b(?:install\s+--frozen-lockfile|--immutable)\b/,
  },
  pip: {
    lockfiles: ['requirements.txt', 'requirements.lock', 'Pipfile.lock'],
    safeFlag: /-r\s+\S+|--require-hashes/,
  },
  uv: {
    lockfiles: ['uv.lock', 'requirements.txt'],
    safeFlag: /\buv\s+sync\b|--frozen/,
  },
  poetry: {
    lockfiles: ['poetry.lock'],
    safeFlag: /\bpoetry\s+install\b/,
  },
};

const INSTALL_DETECT: Array<[RegExp, string]> = [
  [/\bnpm\s+(?:install|i|add)\s+(?!--?(?:save-dev\s+)?ci\b)([^\s-][^\n]*)/, 'npm'],
  [/\bpnpm\s+(?:add|install|i)\s+(?!--frozen-lockfile)([^\s-][^\n]*)/, 'pnpm'],
  [/\byarn\s+(?:add|install)\s+(?!--frozen-lockfile)([^\s-][^\n]*)/, 'yarn'],
  [/\bpip[23]?\s+install\s+(?!-r\b)([^\s-][^\n]*)/, 'pip'],
  [/\buv\s+add\s+([^\n]*)/, 'uv'],
  [/\bpoetry\s+add\s+([^\n]*)/, 'poetry'],
];

/**
 * security/lockfile-required
 *
 * Blocks ad-hoc `npm install <pkg>` / `pip install <pkg>` when the
 * project has a lockfile but the command omits a lockfile-respecting
 * flag. Prevents AI agents from silently drifting the lockfile during
 * autonomous operation.
 */
export const lockfileRequired: Rule = {
  id: 'security/lockfile-required',
  name: 'Lockfile Required',
  description: 'Blocks direct installs that bypass the project lockfile.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/lockfile-required';
    const command = (context.toolInput.command as string) ?? '';
    const repoRoot = context.gitContext.repoRoot;
    if (!command || !repoRoot) return { status: 'pass', ruleId };

    for (const [pattern, managerKey] of INSTALL_DETECT) {
      if (!pattern.test(command)) continue;
      const manager = LOCKFILE_MAP[managerKey];
      if (!manager) continue;
      if (manager.safeFlag.test(command)) return { status: 'pass', ruleId };

      const hasLockfile = manager.lockfiles.some((f) => existsSync(join(repoRoot, f)));
      if (!hasLockfile) return { status: 'pass', ruleId };

      return {
        status: 'block',
        ruleId,
        message: `Install command bypasses existing ${manager.lockfiles[0]}. AI agents routinely drift lockfiles.`,
        fix: `Use a lockfile-respecting command: ${
          managerKey === 'npm'
            ? 'npm ci'
            : managerKey === 'pnpm'
              ? 'pnpm install --frozen-lockfile'
              : managerKey === 'yarn'
                ? 'yarn install --immutable'
                : managerKey === 'pip'
                  ? 'pip install -r requirements.txt'
                  : managerKey === 'uv'
                    ? 'uv sync'
                    : 'poetry install'
        }.`,
        metadata: { manager: managerKey },
      };
    }

    return { status: 'pass', ruleId };
  },
};
