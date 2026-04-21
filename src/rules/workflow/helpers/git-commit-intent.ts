import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gitCommand } from '../../../utils/git.js';

/**
 * Detect whether a Bash command string is attempting a `git commit`.
 * Tolerates common shell composition: `&&`, `||`, `;`, and leading whitespace.
 * Returns true for amend/no-edit variants; returns false for non-commit
 * subcommands (e.g. `git commit-tree`, `git commits-graph`).
 */
export function isGitCommitCommand(command: string | undefined): boolean {
  if (!command || typeof command !== 'string') return false;

  // Split on shell separators (match || before | so we don't break ||).
  // Whitespace-tolerant; segments are trimmed below.
  const segments = command.split(/&&|\|\||;|\|/g);
  for (const raw of segments) {
    const seg = raw.trim();
    // Match `git commit` followed by end-of-string or a space (not commit-tree etc.)
    if (/^git\s+commit(\s|$)/i.test(seg)) return true;
  }
  return false;
}

/**
 * Whether the current repo state represents an in-progress merge commit.
 * Matches the husky `.git/MERGE_HEAD` bypass pattern.
 */
export function isInMergeCommit(repoRoot: string): boolean {
  const gitDir = join(repoRoot, '.git');
  if (!existsSync(gitDir)) return false;
  return existsSync(join(gitDir, 'MERGE_HEAD'));
}

/**
 * List the paths (relative to repoRoot) currently staged for commit.
 * Returns an empty array on any git error or detached state.
 */
export function getStagedFiles(repoRoot: string): string[] {
  const out = gitCommand(['diff', '--cached', '--name-only'], repoRoot);
  if (!out) return [];
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
