import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { normalizePath } from './path.js';
import type { GitContext } from '../types.js';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Run a git command and return the trimmed output.
 * Returns null on any error (not a git repo, command fails, timeout).
 */
export function gitCommand(
  args: string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): string | null {
  try {
    const result = execSync(`git ${args.join(' ')}`, {
      cwd,
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/** Get the current branch name */
export function getCurrentBranch(cwd: string): string | null {
  return gitCommand(['branch', '--show-current'], cwd);
}

/** Get the repository root directory */
export function getRepoRoot(filePath: string): string | null {
  const dir = dirname(filePath);
  const root = gitCommand(['rev-parse', '--show-toplevel'], dir);
  return root ? normalizePath(root) : null;
}

/** Check if the working tree has uncommitted changes */
export function isDirty(cwd: string): boolean {
  const status = gitCommand(['status', '--porcelain'], cwd);
  return status !== null && status.length > 0;
}

/** Count commits ahead of upstream (unpushed) */
export function getUnpushedCount(cwd: string): number {
  const count = gitCommand(['rev-list', '--count', '@{upstream}..HEAD'], cwd);
  return count !== null ? parseInt(count, 10) || 0 : 0;
}

/** Check if the current branch tracks a remote */
export function hasRemoteTracking(cwd: string): boolean {
  const upstream = gitCommand(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    cwd,
  );
  return upstream !== null && upstream.length > 0;
}

/**
 * Build a full GitContext from a file path or directory.
 * Caches nothing — call once per hook invocation and pass the result through.
 */
export function buildGitContext(filePathOrCwd: string): GitContext {
  const repoRoot = getRepoRoot(filePathOrCwd);
  if (!repoRoot) {
    return {
      branch: null,
      isDirty: false,
      repoRoot: null,
      unpushedCount: 0,
      hasRemote: false,
    };
  }

  return {
    branch: getCurrentBranch(repoRoot),
    isDirty: isDirty(repoRoot),
    repoRoot,
    unpushedCount: getUnpushedCount(repoRoot),
    hasRemote: hasRemoteTracking(repoRoot),
  };
}
