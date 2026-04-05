/**
 * `vguard ignore` — manage the project's .vguardignore file without
 * opening it in an editor.
 *
 * Subcommands:
 *   list               print active patterns grouped by source
 *   add <pattern>      append a pattern
 *   remove <pattern>   remove an exact pattern line
 *   check <path>       report whether a path is ignored
 *   init               create a .vguardignore with the default template
 */

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import ignorePkg from 'ignore';

import {
  createIgnoreMatcher,
  clearIgnoreMatcherCache,
  HARDCODED_DEFAULTS,
  VGUARD_IGNORE_FILENAME,
} from '../../utils/ignore.js';
import { normalizePath } from '../../utils/path.js';
import { isAbsolute, relative, resolve } from 'node:path';
import { DEFAULT_VGUARDIGNORE } from './init-templates/vguardignore.js';

function ignorePath(projectRoot: string): string {
  return join(projectRoot, VGUARD_IGNORE_FILENAME);
}

/**
 * Read raw `.vguardignore` content with line endings preserved.
 * Returns `null` if the file doesn't exist.
 */
function readRaw(projectRoot: string): string | null {
  const path = ignorePath(projectRoot);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

async function writeRaw(projectRoot: string, content: string): Promise<void> {
  await writeFile(ignorePath(projectRoot), content, 'utf-8');
}

/**
 * Print every active ignore pattern grouped by source.
 */
export function ignoreListCommand(): void {
  const projectRoot = process.cwd();
  const matcher = createIgnoreMatcher(projectRoot);

  console.log('\n  VGuard ignore patterns\n');

  console.log('  [default]  (always-on, built-in)');
  for (const pattern of HARDCODED_DEFAULTS) {
    console.log(`    ${pattern}`);
  }

  if (matcher.hasFile) {
    console.log(`\n  [${VGUARD_IGNORE_FILENAME}]  ${matcher.filePatterns.length} pattern(s)`);
    if (matcher.filePatterns.length === 0) {
      console.log('    (no non-comment patterns)');
    } else {
      for (const pattern of matcher.filePatterns) {
        console.log(`    ${pattern}`);
      }
    }
  } else {
    console.log(
      `\n  [${VGUARD_IGNORE_FILENAME}]  (not found) — run \`vguard ignore init\` to create one`,
    );
  }

  const total = HARDCODED_DEFAULTS.length + matcher.filePatterns.length;
  console.log(`\n  ${total} pattern(s) total\n`);
}

/**
 * Append a pattern to `.vguardignore`. Creates the file if missing.
 * Refuses to add duplicate patterns.
 */
export async function ignoreAddCommand(pattern: string): Promise<void> {
  const trimmed = pattern.trim();
  if (!trimmed) {
    console.error('  Pattern cannot be empty.');
    process.exit(1);
  }
  if (trimmed.startsWith('#')) {
    console.error('  Refusing to add a comment as a pattern.');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const existing = readRaw(projectRoot);

  let content: string;
  if (existing === null) {
    // Create from template + the new pattern at the end.
    content = DEFAULT_VGUARDIGNORE.trimEnd() + '\n\n' + trimmed + '\n';
    console.log(`  Created ${VGUARD_IGNORE_FILENAME} with "${trimmed}".`);
  } else {
    // Duplicate check against non-comment lines.
    const lines = existing.split(/\r?\n/);
    const alreadyPresent = lines.map((l) => l.trim()).some((l) => l === trimmed);
    if (alreadyPresent) {
      console.log(`  "${trimmed}" is already in ${VGUARD_IGNORE_FILENAME}.`);
      return;
    }
    const needsNewline = !existing.endsWith('\n');
    content = existing + (needsNewline ? '\n' : '') + trimmed + '\n';
    console.log(`  Added "${trimmed}" to ${VGUARD_IGNORE_FILENAME}.`);
  }

  await writeRaw(projectRoot, content);
  clearIgnoreMatcherCache();
}

/**
 * Remove the first exact-match line from `.vguardignore`. Comments and
 * blank lines are preserved.
 */
export async function ignoreRemoveCommand(pattern: string): Promise<void> {
  const trimmed = pattern.trim();
  if (!trimmed) {
    console.error('  Pattern cannot be empty.');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const existing = readRaw(projectRoot);
  if (existing === null) {
    console.log(`  No ${VGUARD_IGNORE_FILENAME} found — nothing to remove.`);
    return;
  }

  const lines = existing.split(/\r?\n/);
  let removed = 0;
  const next = lines.filter((line) => {
    if (line.trim() === trimmed) {
      removed++;
      return false;
    }
    return true;
  });

  if (removed === 0) {
    console.log(`  "${trimmed}" is not in ${VGUARD_IGNORE_FILENAME}.`);
    return;
  }

  await writeRaw(projectRoot, next.join('\n'));
  clearIgnoreMatcherCache();
  console.log(`  Removed "${trimmed}" from ${VGUARD_IGNORE_FILENAME}.`);
}

/**
 * Report whether a given path is ignored, and by which pattern source.
 */
export function ignoreCheckCommand(path: string): void {
  if (!path) {
    console.error('  Usage: vguard ignore check <path>');
    process.exit(1);
  }
  const projectRoot = process.cwd();
  const matcher = createIgnoreMatcher(projectRoot);
  const isIgnored = matcher.isIgnored(path);

  if (!isIgnored) {
    console.log(`  included ${path}`);
    console.log('           (no pattern matched)');
    return;
  }

  console.log(`  ignored  ${path}`);

  // Test each bucket separately to tell the user WHICH source matched.
  const rel = toRelativeForIgnore(projectRoot, path);
  if (!rel) {
    console.log('           (matched)');
    return;
  }

  const defaultsIg = ignorePkg().add([...HARDCODED_DEFAULTS]);
  if (defaultsIg.ignores(rel)) {
    console.log('           (matched by built-in default)');
    return;
  }

  if (matcher.filePatterns.length > 0) {
    const fileIg = ignorePkg().add(matcher.filePatterns);
    if (fileIg.ignores(rel)) {
      console.log(`           (matched by ${VGUARD_IGNORE_FILENAME})`);
      return;
    }
  }

  console.log('           (matched by a passed-in extra pattern)');
}

function toRelativeForIgnore(projectRoot: string, filePath: string): string {
  const normalised = normalizePath(filePath);
  if (isAbsolute(filePath)) {
    return normalizePath(relative(resolve(projectRoot), filePath));
  }
  return normalised.replace(/^\.\//, '');
}

/**
 * Create a `.vguardignore` with the default template.
 * No-op (and reports "already exists") if the file is present.
 */
export async function ignoreInitCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const path = ignorePath(projectRoot);
  if (existsSync(path)) {
    console.log(`  ${VGUARD_IGNORE_FILENAME} already exists — leaving it untouched.`);
    return;
  }
  await writeRaw(projectRoot, DEFAULT_VGUARDIGNORE);
  clearIgnoreMatcherCache();
  console.log(`  Created ${VGUARD_IGNORE_FILENAME}`);
}
