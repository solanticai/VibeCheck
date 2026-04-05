/**
 * Project-level integration helpers for VGuard.
 *
 * - {@link injectPackageJsonScripts} — adds every `vguard:*` npm script to the
 *   user's `package.json` (additively, never overwriting existing keys).
 * - {@link writeCommandsReference} — writes `.vguard/COMMANDS.md`, a universal
 *   reference file listing every command, its description, and its npm script
 *   shortcut. Works for any project, including those without a `package.json`.
 * - {@link applyProjectIntegrations} — combined entry point used by
 *   `vguard init` (interactive) and `vguard generate` (silent refresh).
 */

import inquirer from 'inquirer';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  buildScriptsRecord,
  getCommandsByCategory,
} from './command-registry.js';

export interface InjectResult {
  /** Number of scripts newly added to package.json. */
  added: number;
  /** Number of scripts already present and left untouched. */
  skipped: number;
  /** `true` when no package.json exists in the project root. */
  noPackageJson: boolean;
}

/**
 * Inject the full set of `vguard:*` scripts into the project's package.json.
 *
 * Behaviour:
 *  - Never overwrites an existing script key.
 *  - Silently no-ops if `package.json` is missing or unreadable (fail-open).
 *  - Preserves the existing field order as produced by JSON.parse.
 */
export async function injectPackageJsonScripts(projectRoot: string): Promise<InjectResult> {
  const pkgPath = join(projectRoot, 'package.json');

  if (!existsSync(pkgPath)) {
    return { added: 0, skipped: 0, noPackageJson: true };
  }

  let pkg: { scripts?: Record<string, string>; [key: string]: unknown };
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    pkg = JSON.parse(raw);
  } catch {
    // Malformed package.json — fail open, leave untouched.
    return { added: 0, skipped: 0, noPackageJson: false };
  }

  const existing: Record<string, string> = pkg.scripts ?? {};
  const desired = buildScriptsRecord();

  let added = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(desired)) {
    if (key in existing) {
      skipped++;
    } else {
      existing[key] = value;
      added++;
    }
  }

  if (added === 0) {
    return { added: 0, skipped, noPackageJson: false };
  }

  pkg.scripts = existing;

  try {
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch {
    // Write failure — fail open.
    return { added: 0, skipped, noPackageJson: false };
  }

  return { added, skipped, noPackageJson: false };
}

/**
 * Write `.vguard/COMMANDS.md`, a grouped reference of every VGuard CLI command.
 *
 * Always writes (overwrites) the file. This keeps the reference in sync with
 * the registry across VGuard upgrades.
 */
export async function writeCommandsReference(projectRoot: string): Promise<void> {
  const outPath = join(projectRoot, '.vguard', 'COMMANDS.md');
  const content = renderCommandsMarkdown();

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, content, 'utf-8');
}

/**
 * Render the markdown body of `.vguard/COMMANDS.md`.
 *
 * Exposed for testing.
 */
export function renderCommandsMarkdown(): string {
  const grouped = getCommandsByCategory();
  const lines: string[] = [];

  lines.push('# VGuard — Project Commands');
  lines.push('');
  lines.push(
    'Every VGuard CLI command is available as an npm script in this project. Run any command with:',
  );
  lines.push('');
  lines.push('```bash');
  lines.push('npm run vguard:<command>');
  lines.push('# or, for a specific argument:');
  lines.push('npm run vguard:add -- security/branch-protection');
  lines.push('```');
  lines.push('');
  lines.push('> This file is regenerated automatically by `vguard init` and `vguard generate`.');
  lines.push('> Do not edit it by hand — your changes will be overwritten.');
  lines.push('');

  for (const category of CATEGORY_ORDER) {
    const commands = grouped[category];
    if (commands.length === 0) continue;

    lines.push(`## ${CATEGORY_LABELS[category]}`);
    lines.push('');
    lines.push('| npm script | CLI command | Description |');
    lines.push('| --- | --- | --- |');

    for (const cmd of commands) {
      const invocation = cmd.acceptsArgs ? `${cmd.cliInvocation} <arg>` : cmd.cliInvocation;
      const description = cmd.notes ? `${cmd.description}<br>_${cmd.notes}_` : cmd.description;
      lines.push(`| \`npm run ${cmd.scriptName}\` | \`${invocation}\` | ${description} |`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('To pass flags or arguments to any command, use the npm `--` separator. For example:');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run vguard:lint -- --format json');
  lines.push('npm run vguard:upgrade -- --check');
  lines.push('npm run vguard:sync -- --dry-run');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

export interface ApplyIntegrationsOptions {
  /**
   * When `true`, prompt the user before modifying `package.json`.
   * Used by `vguard init`.
   *
   * When `false`, apply changes silently. Used by `vguard generate` to
   * keep scripts + COMMANDS.md in sync as VGuard versions add new commands.
   */
  interactive: boolean;
}

/**
 * Combined entry point used by both `init` and `generate` commands.
 */
export async function applyProjectIntegrations(
  projectRoot: string,
  options: ApplyIntegrationsOptions,
): Promise<void> {
  // Always write the universal reference file — it's the only guaranteed
  // "view all commands" surface for projects without a package.json.
  try {
    await writeCommandsReference(projectRoot);
    if (!options.interactive) {
      console.log('  Refreshed .vguard/COMMANDS.md');
    } else {
      console.log('  Created .vguard/COMMANDS.md — see it for a full command reference');
    }
  } catch {
    // Non-critical — skip silently.
  }

  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return;

  let shouldInject = true;

  if (options.interactive) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addScripts',
        message: 'Add VGuard command shortcuts to package.json?',
        default: true,
      },
    ]);
    shouldInject = Boolean(answer.addScripts);
  }

  if (!shouldInject) return;

  const result = await injectPackageJsonScripts(projectRoot);

  if (options.interactive) {
    if (result.added > 0) {
      console.log(`  Added ${result.added} VGuard scripts to package.json`);
    } else if (result.skipped > 0) {
      console.log('  VGuard scripts already present in package.json');
    }
  } else if (result.added > 0) {
    console.log(`  Added ${result.added} new VGuard scripts to package.json`);
  }
}
