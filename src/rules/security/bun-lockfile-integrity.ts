import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

/**
 * security/bun-lockfile-integrity (bun preset)
 *
 * Warns when `bun install` is run without --frozen-lockfile in a project
 * that has a bun.lockb. Mirrors the broader lockfile-required rule but
 * targets Bun's lockfile binary format specifically.
 */
export const bunLockfileIntegrity: Rule = {
  id: 'security/bun-lockfile-integrity',
  name: 'Bun Lockfile Integrity',
  description: 'Warns when bun install runs without --frozen-lockfile.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },

  check: (context): RuleResult => {
    const ruleId = 'security/bun-lockfile-integrity';
    const command = (context.toolInput.command as string) ?? '';
    const repoRoot = context.gitContext.repoRoot;
    if (!command || !repoRoot) return { status: 'pass', ruleId };
    if (!/\bbun\s+(?:install|i|add)\b/.test(command)) return { status: 'pass', ruleId };
    if (/--frozen-lockfile\b/.test(command)) return { status: 'pass', ruleId };
    if (!existsSync(join(repoRoot, 'bun.lockb')) && !existsSync(join(repoRoot, 'bun.lock'))) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message: 'bun install without --frozen-lockfile can drift the lockfile.',
      fix: 'Use `bun install --frozen-lockfile` in CI and scripted contexts.',
    };
  },
};
