/**
 * Project-wide ignore matcher.
 *
 * Loads `.vguardignore` from the project root (if present), merges it with
 * hardcoded defaults, and exposes a single `isIgnored(path)` helper used by
 * the lint scanner, runtime hooks, the learn walker, and the cloud sync
 * exclusions. One matcher is cached per project root so the file is only
 * read once per process.
 *
 * Behaviour mirrors `.gitignore` because it is powered by the `ignore`
 * package (the de-facto standard used by ESLint, Prettier, stylelint).
 * That means negation (`!pattern`), directory suffixes (`foo/`), glob
 * wildcards (`**`, `*`, `?`), and comments (`# …`) all work.
 *
 * Fail-open: any error while reading or parsing falls back to a matcher
 * that only knows the hardcoded defaults. A missing `.vguardignore` is
 * expected and never warns.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import ignorePkg from 'ignore';

import { normalizePath } from './path.js';

/** The filename we look for in the project root. */
export const VGUARD_IGNORE_FILENAME = '.vguardignore';

/**
 * Hardcoded defaults that every project should ignore — these match the
 * paths that the pre-matcher scanner used to hardcode in DEFAULT_EXCLUDE.
 * They can still be overridden by the user's `.vguardignore` (via `!`
 * negation) if a legitimate use case arises.
 */
export const HARDCODED_DEFAULTS: readonly string[] = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '.git/',
  'coverage/',
  '.vguard/',
  '.turbo/',
  '__pycache__/',
  '.venv/',
] as const;

export interface IgnoreMatcher {
  /**
   * Returns `true` if the given file path (absolute or relative) should
   * be ignored by all VGuard execution paths.
   */
  isIgnored(filePath: string): boolean;
  /** Active patterns (defaults + file + extras) — exposed for `vguard doctor`. */
  patterns: string[];
  /** Was a `.vguardignore` actually loaded from disk? */
  hasFile: boolean;
  /**
   * Which patterns came from the `.vguardignore` file
   * (not the hardcoded defaults, not the extras).
   */
  filePatterns: string[];
  /** Project root this matcher was built for (absolute, normalised). */
  projectRoot: string;
}

/** Per-projectRoot cache so multiple callers re-use one matcher. */
const matcherCache = new Map<string, IgnoreMatcher>();

/**
 * Build (or return cached) matcher for the given project root.
 *
 * @param projectRoot Absolute path to the project root.
 * @param extraPatterns Additional patterns to merge in on top of the file
 *   + defaults. Used by the learn walker (`learn.ignorePaths`) and the
 *   cloud sync privacy filter (`cloud.excludePaths`) to bridge their
 *   legacy config fields into the new unified matcher.
 */
export function createIgnoreMatcher(
  projectRoot: string,
  extraPatterns: readonly string[] = [],
): IgnoreMatcher {
  const absRoot = resolve(projectRoot);
  // Extras change per-caller, so we can only cache when they are absent.
  const canCache = extraPatterns.length === 0;

  if (canCache) {
    const cached = matcherCache.get(absRoot);
    if (cached) return cached;
  }

  let filePatterns: string[] = [];
  let hasFile = false;

  try {
    const ignorePath = join(absRoot, VGUARD_IGNORE_FILENAME);
    if (existsSync(ignorePath)) {
      const raw = readFileSync(ignorePath, 'utf-8');
      filePatterns = parseIgnoreFile(raw);
      hasFile = true;
    }
  } catch {
    // Fail-open — fall back to defaults only.
    filePatterns = [];
    hasFile = false;
  }

  const patterns = [...HARDCODED_DEFAULTS, ...filePatterns, ...extraPatterns];

  // `ignore()` returns its own type; its `add()` accepts comma- or newline-
  // separated strings OR arrays. It silently skips empty lines + comments.
  const ig = ignorePkg();
  try {
    ig.add(patterns);
  } catch {
    // Shouldn't happen with string patterns, but stay fail-open.
  }

  const matcher: IgnoreMatcher = {
    patterns,
    hasFile,
    filePatterns,
    projectRoot: absRoot,
    isIgnored(filePath: string): boolean {
      try {
        const rel = toRelativePath(absRoot, filePath);
        // The ignore package refuses empty strings, `./`, and paths that
        // escape the project root (`../…`). None of those should ever be
        // ignored — treat them as included.
        if (!rel || rel.startsWith('..')) return false;
        return ig.ignores(rel);
      } catch {
        return false;
      }
    },
  };

  if (canCache) {
    matcherCache.set(absRoot, matcher);
  }
  return matcher;
}

/**
 * Clear the in-memory matcher cache. Called by `vguard generate` so that
 * user edits to `.vguardignore` propagate to the next lint/hook run
 * without restarting the process, and by tests for isolation.
 */
export function clearIgnoreMatcherCache(): void {
  matcherCache.clear();
}

/**
 * Parse raw `.vguardignore` content into a list of non-empty, non-comment
 * pattern lines. Blank lines and `# …` comments are stripped here so the
 * `patterns` array exposed on the matcher is useful for humans (via
 * `vguard doctor` + `vguard ignore list`).
 */
function parseIgnoreFile(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Convert an arbitrary file path to a forward-slashed, project-root-relative
 * path suitable for feeding to the `ignore` package.
 *
 * - Absolute path → made relative to projectRoot.
 * - Relative path → left alone (assumed to already be relative to projectRoot).
 * - Windows backslashes → forward slashes.
 */
function toRelativePath(projectRoot: string, filePath: string): string {
  const normalised = normalizePath(filePath);
  if (isAbsolute(filePath)) {
    return normalizePath(relative(projectRoot, filePath));
  }
  // Strip any leading ./
  return normalised.replace(/^\.\//, '');
}
