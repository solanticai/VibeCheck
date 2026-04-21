import type { MonorepoConfig, RuleConfig, VGuardConfig } from '../types.js';

/**
 * Resolve which monorepo override entry (if any) applies to a file path.
 *
 * Given a `monorepo.overrides` map keyed by workspace glob (e.g.
 * `apps/mobile`, `apps/*`, `packages/ui`), this returns the entry whose
 * key matches the longest prefix of the project-relative `filePath`.
 * "Most specific" is defined as the fewest wildcards; ties are broken
 * by longest literal prefix, then by declaration order.
 *
 * Returns `null` when:
 *   - `filePath` is absent,
 *   - `monorepo.overrides` is empty,
 *   - no key matches the file.
 */
export function findWorkspaceOverride(
  monorepo: MonorepoConfig | undefined,
  filePath: string | undefined,
): { presets?: string[]; rules?: Record<string, RuleConfig | boolean> } | null {
  if (!monorepo?.overrides || !filePath) return null;

  const normalised = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

  type Candidate = {
    key: string;
    literalPrefixLen: number;
    wildcardCount: number;
    value: { presets?: string[]; rules?: Record<string, RuleConfig | boolean> };
    index: number;
  };

  const candidates: Candidate[] = [];
  let index = 0;
  for (const [key, value] of Object.entries(monorepo.overrides)) {
    const pattern = key.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    if (matchesWorkspaceGlob(pattern, normalised)) {
      const wildcardCount = (pattern.match(/\*/g) ?? []).length;
      const literalPrefixLen = literalPrefixLength(pattern);
      candidates.push({
        key,
        literalPrefixLen,
        wildcardCount,
        value: value as Candidate['value'],
        index,
      });
    }
    index += 1;
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // Fewer wildcards = more specific.
    if (a.wildcardCount !== b.wildcardCount) return a.wildcardCount - b.wildcardCount;
    // Longer literal prefix = more specific.
    if (a.literalPrefixLen !== b.literalPrefixLen) return b.literalPrefixLen - a.literalPrefixLen;
    // Tie-break by declaration order so the first-declared wins.
    return a.index - b.index;
  });

  return candidates[0].value;
}

/**
 * Produce a VGuardConfig with the matching workspace override layered
 * on top of the root config. Only `presets` and `rules` are carried
 * over from the override; other fields (agents, cloud, etc.) remain
 * from the root.
 */
export function applyWorkspaceOverride(
  base: VGuardConfig,
  filePath: string | undefined,
): VGuardConfig {
  const override = findWorkspaceOverride(base.monorepo, filePath);
  if (!override) return base;

  return {
    ...base,
    presets: override.presets ?? base.presets,
    rules: {
      ...(base.rules ?? {}),
      ...(override.rules ?? {}),
    },
  };
}

/** Match a single workspace-style glob against a POSIX-normalised path.
 *  Supports `*` (single path segment), `**` (any subtree), and literal
 *  directory prefixes. `apps/mobile` matches `apps/mobile`,
 *  `apps/mobile/foo.ts`, and `apps/mobile/nested/bar.ts` — anything
 *  rooted under that prefix.
 */
function matchesWorkspaceGlob(pattern: string, path: string): boolean {
  const escaped = pattern
    .split('/')
    .map((segment) =>
      segment === '**'
        ? '(?:.*)'
        : segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'),
    )
    .join('/');
  const re = new RegExp(`^${escaped}(/.*)?$`);
  return re.test(path);
}

/** Count the literal characters leading up to the first `*` in a glob. */
function literalPrefixLength(pattern: string): number {
  const star = pattern.indexOf('*');
  return star < 0 ? pattern.length : star;
}
