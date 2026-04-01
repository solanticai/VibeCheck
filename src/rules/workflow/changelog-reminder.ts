import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

/**
 * workflow/changelog-reminder
 *
 * At session end (Stop hook), checks if significant changes were made
 * (> 5 files touched, or any migration files) and reminds to update
 * CHANGELOG.md if it wasn't modified.
 */
export const changelogReminder: Rule = {
  id: 'workflow/changelog-reminder',
  name: 'Changelog Reminder',
  description: 'Reminds to update CHANGELOG.md when significant changes are made.',
  severity: 'info',
  events: ['Stop'],

  check: (context): RuleResult => {
    const ruleId = 'workflow/changelog-reminder';
    const projectRoot = context.gitContext.repoRoot;

    if (!projectRoot) return { status: 'pass', ruleId };

    // Check if CHANGELOG.md exists
    const changelogPath = join(projectRoot, 'CHANGELOG.md');
    if (!existsSync(changelogPath)) return { status: 'pass', ruleId };

    // Check git status for number of changed files
    const changedFiles = getChangedFiles(projectRoot);
    if (changedFiles.length === 0) return { status: 'pass', ruleId };

    // Check if CHANGELOG.md was already modified
    const changelogModified = changedFiles.some(
      (f) => f.toLowerCase() === 'changelog.md',
    );
    if (changelogModified) return { status: 'pass', ruleId };

    // Check for significant changes
    const hasMigrations = changedFiles.some(
      (f) =>
        f.toLowerCase().includes('migration') ||
        f.toLowerCase().includes('/migrations/'),
    );
    const isSignificant = changedFiles.length > 5 || hasMigrations;

    if (isSignificant) {
      const reason = hasMigrations
        ? 'Migration files were modified'
        : `${changedFiles.length} files were changed`;

      return {
        status: 'warn',
        ruleId,
        message: `${reason} but CHANGELOG.md was not updated.`,
        fix: 'Add an entry to CHANGELOG.md describing the changes.',
        metadata: { fileCount: changedFiles.length, hasMigrations },
      };
    }

    return { status: 'pass', ruleId };
  },
};

function getChangedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    try {
      const output = execSync('git diff --name-only', {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}
