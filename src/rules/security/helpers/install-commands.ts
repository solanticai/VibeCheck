/**
 * Shared parsers for `install` commands across npm/pnpm/yarn/pip/uv/poetry.
 * Used by:
 *   - security/package-hallucination-guard (single-command strict match)
 *   - security/package-typosquat-guard    (multi-occurrence scan)
 *
 * Keep the two parsers here so rules in this category stay aligned as the
 * package-manager ecosystem evolves.
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'pip' | 'uv' | 'poetry';

export interface ParsedInstall {
  manager: PackageManager;
  packages: string[];
}

/**
 * Split a raw arg blob into bare package names, dropping flags and version
 * specifiers. Accepts tokens like `lodash@4.17.21`, `lodash`, `@types/node`,
 * `django==4.2`, and rejects `-D`, `--save-dev`, absolute paths.
 */
export function extractPackageNames(raw: string): string[] {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => !tok.startsWith('-') && !tok.startsWith('/'))
    .map((tok) => tok.replace(/[@~=].*$/, '').replace(/==.*$/, ''))
    .filter((name) => /^[@a-zA-Z0-9][\w.@/-]*$/.test(name));
}

/**
 * Strict single-command parse — expects the ENTIRE command to be one
 * `<manager> install <pkgs>` invocation. Used when we only want to act on
 * commands that are clearly installs (not inside a long pipeline).
 *
 * Returns null if the command is not a recognisable install command.
 */
export function parseSingleInstallCommand(command: string): ParsedInstall | null {
  const cmd = command.trim();

  let m = cmd.match(/^\s*(?:sudo\s+)?npm\s+(?:install|i|add)\s+([^\n]+)$/i);
  if (m) return { manager: 'npm', packages: extractPackageNames(m[1] ?? '') };

  m = cmd.match(/^\s*pnpm\s+(?:add|install|i)\s+([^\n]+)$/i);
  if (m) return { manager: 'pnpm', packages: extractPackageNames(m[1] ?? '') };

  m = cmd.match(/^\s*yarn\s+(?:add|install)\s+([^\n]+)$/i);
  if (m) return { manager: 'yarn', packages: extractPackageNames(m[1] ?? '') };

  m = cmd.match(/^\s*(?:python\s+-m\s+)?pip[23]?\s+install\s+([^\n]+)$/i);
  if (m) return { manager: 'pip', packages: extractPackageNames(m[1] ?? '') };

  m = cmd.match(/^\s*uv\s+(?:add|pip\s+install)\s+([^\n]+)$/i);
  if (m) return { manager: 'uv', packages: extractPackageNames(m[1] ?? '') };

  m = cmd.match(/^\s*poetry\s+add\s+([^\n]+)$/i);
  if (m) return { manager: 'poetry', packages: extractPackageNames(m[1] ?? '') };

  return null;
}

/**
 * Permissive multi-occurrence scan — finds every install invocation inside
 * a compound command (`a && b; pip install x | tee`). Returns a flat list
 * of package names across all hits.
 */
export function extractAllInstallTargets(command: string): string[] {
  const all: string[] = [];
  const regexes = [
    /\bnpm\s+(?:install|i|add)\s+([^\n|&;]+)/gi,
    /\bpnpm\s+(?:add|install|i)\s+([^\n|&;]+)/gi,
    /\byarn\s+(?:add|install)\s+([^\n|&;]+)/gi,
    /\bpip[23]?\s+install\s+([^\n|&;]+)/gi,
    /\buv\s+(?:add|pip\s+install)\s+([^\n|&;]+)/gi,
    /\bpoetry\s+add\s+([^\n|&;]+)/gi,
  ];
  for (const re of regexes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(command)) !== null) {
      all.push(...extractPackageNames(m[1] ?? ''));
    }
  }
  return all;
}
