import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Rule, RuleResult } from '../../types.js';

/**
 * workflow/lockfile-version-match
 *
 * Ported from the VGuard project's own .husky/pre-commit (issue #52,
 * 2026-04-22). Blocks `git commit` when package.json version has been
 * bumped but package-lock.json's top-level `version` field is out of
 * sync — a real bug that causes `npm ci` on a clean clone to reproduce
 * the pre-bump tree.
 *
 * Runs in the native git pre-commit hook only; there is no sensible
 * PreToolUse analogue because Claude Code's Bash tool sees the commit
 * command, not the resolved lockfile state.
 */
export const lockfileVersionMatch: Rule = {
  id: 'workflow/lockfile-version-match',
  name: 'Lockfile Version Match',
  description:
    'Blocks commits when package.json version does not match package-lock.json top-level version.',
  severity: 'block',
  events: ['git:pre-commit'],
  match: { tools: ['git'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/lockfile-version-match';

    try {
      const repoRoot = context.gitContext.repoRoot ?? process.cwd();
      const pkgPath = join(repoRoot, 'package.json');
      const lockPath = join(repoRoot, 'package-lock.json');

      if (!existsSync(pkgPath) || !existsSync(lockPath)) {
        return { status: 'pass', ruleId };
      }

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { version?: string };

      if (!pkg.version || !lock.version) return { status: 'pass', ruleId };

      if (pkg.version === lock.version) return { status: 'pass', ruleId };

      return {
        status: 'block',
        ruleId,
        message: `package-lock.json version (${lock.version}) does not match package.json (${pkg.version}).`,
        fix: 'Run `npm install --package-lock-only && git add package-lock.json` before committing.',
        metadata: { pkgVersion: pkg.version, lockVersion: lock.version },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
