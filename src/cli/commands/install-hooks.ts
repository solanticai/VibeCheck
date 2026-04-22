/**
 * `vguard install-hooks` — install native git pre-commit and commit-msg
 * hooks that invoke VGuard's workflow rules. Replaces the old husky setup.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { info, warn } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

export interface InstallHooksOptions {
  uninstall?: boolean;
  silent?: boolean;
  force?: boolean;
}

const MANAGED_MARKER = '# vguard-managed-hook';

const PRE_COMMIT_BODY = `#!/bin/sh
${MANAGED_MARKER}
# Installed by \`vguard install-hooks\`. Re-run the command to regenerate.
# Uninstall with \`vguard install-hooks --uninstall\`.
[ "$VGUARD_SKIP_HOOKS" = "1" ] && exit 0
# Resolve the vguard CLI: prefer the local node_modules bin, fall back to
# a globally installed vguard, then fail open if neither is present.
if [ -x "./node_modules/.bin/vguard" ]; then
  VGUARD_BIN="./node_modules/.bin/vguard"
elif command -v vguard >/dev/null 2>&1; then
  VGUARD_BIN="vguard"
else
  exit 0
fi
"$VGUARD_BIN" _run-git-hook git:pre-commit
`;

const COMMIT_MSG_BODY = `#!/bin/sh
${MANAGED_MARKER}
# Installed by \`vguard install-hooks\`. Receives the commit-message file path as $1.
[ "$VGUARD_SKIP_HOOKS" = "1" ] && exit 0
if [ -x "./node_modules/.bin/vguard" ]; then
  VGUARD_BIN="./node_modules/.bin/vguard"
elif command -v vguard >/dev/null 2>&1; then
  VGUARD_BIN="vguard"
else
  exit 0
fi
"$VGUARD_BIN" _run-git-hook git:commit-msg "$1"
`;

const HOOKS: Array<{ name: string; body: string }> = [
  { name: 'pre-commit', body: PRE_COMMIT_BODY },
  { name: 'commit-msg', body: COMMIT_MSG_BODY },
];

function findGitHooksDir(projectRoot: string): string | null {
  const gitDir = join(projectRoot, '.git');
  if (!existsSync(gitDir)) return null;
  // Handle worktrees / submodules: .git may be a file with `gitdir:` pointer.
  try {
    const stat = readFileSync(gitDir, 'utf8');
    if (stat.startsWith('gitdir:')) {
      const pointer = stat.slice('gitdir:'.length).trim();
      const resolved = pointer.startsWith('/') ? pointer : join(projectRoot, pointer);
      return join(resolved, 'hooks');
    }
  } catch {
    // It's a directory, not a file — normal repo layout.
  }
  return join(gitDir, 'hooks');
}

function isManagedHook(path: string): boolean {
  try {
    return readFileSync(path, 'utf8').includes(MANAGED_MARKER);
  } catch {
    return false;
  }
}

export async function installHooksCommand(options: InstallHooksOptions = {}): Promise<void> {
  if (process.env.VGUARD_NO_INSTALL_HOOKS === '1') {
    if (!options.silent) info('VGUARD_NO_INSTALL_HOOKS=1 — skipping hook installation.');
    process.exit(EXIT.OK);
  }

  const projectRoot = process.cwd();
  const hooksDir = findGitHooksDir(projectRoot);

  if (!hooksDir) {
    if (!options.silent) {
      warn('No .git directory found — skipping hook installation.');
    }
    process.exit(EXIT.OK);
  }

  if (options.uninstall) {
    let removed = 0;
    for (const { name } of HOOKS) {
      const hookPath = join(hooksDir, name);
      if (existsSync(hookPath) && isManagedHook(hookPath)) {
        try {
          unlinkSync(hookPath);
          removed += 1;
          if (!options.silent) info(`${glyph('pass')} Removed .git/hooks/${name}`);
        } catch (err) {
          warn(`Failed to remove ${hookPath}: ${(err as Error).message}`);
        }
      } else if (existsSync(hookPath) && !options.silent) {
        info(`${glyph('dot')} Skipped .git/hooks/${name} (not vguard-managed)`);
      }
    }
    if (!options.silent) {
      info(
        removed > 0
          ? color.green(`Removed ${removed} VGuard hook${removed === 1 ? '' : 's'}.`)
          : 'Nothing to uninstall.',
      );
    }
    process.exit(EXIT.OK);
  }

  // Install mode
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  let written = 0;
  for (const { name, body } of HOOKS) {
    const hookPath = join(hooksDir, name);
    const exists = existsSync(hookPath);

    if (exists && !isManagedHook(hookPath) && !options.force) {
      if (!options.silent) {
        warn(
          `.git/hooks/${name} exists and is not vguard-managed. Re-run with --force to replace it.`,
        );
      }
      continue;
    }

    try {
      writeFileSync(hookPath, body, 'utf8');
      try {
        // 0o755 — owner rwx, group+other rx
        chmodSync(hookPath, 0o755);
      } catch {
        // chmod is a no-op on Windows; git-for-windows still executes the file.
      }
      written += 1;
      if (!options.silent) info(`${glyph('pass')} Installed .git/hooks/${name}`);
    } catch (err) {
      warn(`Failed to write ${hookPath}: ${(err as Error).message}`);
    }
  }

  if (!options.silent) {
    info(
      written > 0
        ? color.green(`Installed ${written} VGuard hook${written === 1 ? '' : 's'}.`)
        : 'No hooks written.',
    );
    if (written > 0) {
      info(
        `Disable temporarily with ${color.cyan('VGUARD_SKIP_HOOKS=1 git commit …')} or remove with ${color.cyan('vguard install-hooks --uninstall')}.`,
      );
    }
  }

  process.exit(EXIT.OK);
}
