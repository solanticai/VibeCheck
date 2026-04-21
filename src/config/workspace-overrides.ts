import type { MonorepoConfig, RuleConfig, VGuardConfig } from '../types.js';

type OverrideValue = { presets?: string[]; rules?: Record<string, RuleConfig | boolean> };

interface CompiledOverride {
  /** Original override key (for debug output / error messages). */
  key: string;
  /** Pre-built matcher RegExp, anchored `^…$`. */
  re: RegExp;
  /** Number of `*` characters in the source pattern — fewer = more specific. */
  wildcardCount: number;
  /** Number of literal characters leading up to the first `*`. */
  literalPrefixLen: number;
  /** Declaration order in the original object — used as a tie-break. */
  index: number;
  /** Original override value (`presets` + `rules`). */
  value: OverrideValue;
}

/**
 * Per-MonorepoConfig cache of compiled matchers. Keyed on the object
 * reference, so repeated `findWorkspaceOverride` calls against the same
 * resolved config (typical of a `vguard lint` run) amortise the RegExp
 * construction cost over every file touched — first call compiles, all
 * subsequent calls reuse.
 *
 * `WeakMap` ensures we don't leak compiled matchers when the user
 * reloads their config (the old `monorepo` reference becomes eligible
 * for GC along with its cache entry).
 */
const compiledCache = new WeakMap<MonorepoConfig, CompiledOverride[]>();

/**
 * Test-only hook: total number of times `compileOverrides` has
 * re-walked the override list since module load. Each increment
 * corresponds to one `new RegExp` per override key — unchanged across
 * repeated lookups against a cached `MonorepoConfig`, incremented
 * once per fresh `MonorepoConfig` reference.
 *
 * Exported so the test suite can verify the cache without monkey-
 * patching the global RegExp constructor (which vitest's `vi.spyOn`
 * does poorly on `new`-invocations).
 *
 * Not part of the public contract; do not read outside tests.
 */
export const __testGetCompileCount = (): number => compileCount;
let compileCount = 0;

function compileOverrides(monorepo: MonorepoConfig): CompiledOverride[] {
  const cached = compiledCache.get(monorepo);
  if (cached) return cached;

  compileCount += 1;
  const overrides = monorepo.overrides ?? {};
  const compiled: CompiledOverride[] = [];
  let index = 0;
  for (const [key, value] of Object.entries(overrides)) {
    const pattern = key.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    compiled.push({
      key,
      re: buildWorkspaceGlobRegex(pattern),
      wildcardCount: (pattern.match(/\*/g) ?? []).length,
      literalPrefixLen: literalPrefixLength(pattern),
      index,
      value: value as OverrideValue,
    });
    index += 1;
  }

  compiledCache.set(monorepo, compiled);
  return compiled;
}

/**
 * Resolve which monorepo override entry (if any) applies to a file path.
 *
 * Given a `monorepo.overrides` map keyed by workspace glob (e.g.
 * `apps/mobile`, `apps/*`, `packages/ui`), this returns the entry whose
 * key matches the longest prefix of the project-relative `filePath`.
 * "Most specific" is defined as the fewest wildcards; ties are broken
 * by longest literal prefix, then by declaration order.
 *
 * Matchers are compiled lazily and cached against the `monorepo`
 * reference, so repeated calls in a single lint run don't pay the
 * RegExp construction cost more than once per override key.
 *
 * Returns `null` when:
 *   - `filePath` is absent,
 *   - `monorepo.overrides` is empty,
 *   - no key matches the file.
 */
export function findWorkspaceOverride(
  monorepo: MonorepoConfig | undefined,
  filePath: string | undefined,
): OverrideValue | null {
  if (!monorepo?.overrides || !filePath) return null;

  const compiled = compileOverrides(monorepo);
  if (compiled.length === 0) return null;

  const normalised = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

  const candidates: CompiledOverride[] = [];
  for (const entry of compiled) {
    if (entry.re.test(normalised)) {
      candidates.push(entry);
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.wildcardCount !== b.wildcardCount) return a.wildcardCount - b.wildcardCount;
    if (a.literalPrefixLen !== b.literalPrefixLen) return b.literalPrefixLen - a.literalPrefixLen;
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

/**
 * Build the anchored RegExp for a single workspace glob.
 *
 * Supports `*` (single path segment) and `**` (any subtree). Literal
 * directory prefixes match themselves and everything below them —
 * `apps/mobile` matches `apps/mobile`, `apps/mobile/foo.ts`, and
 * `apps/mobile/nested/bar.ts`. Regex metacharacters outside `*` are
 * escaped.
 *
 * Exported for the test suite so the compile step can be exercised
 * without going through the caching layer.
 */
export function buildWorkspaceGlobRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((segment) =>
      segment === '**'
        ? '(?:.*)'
        : segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'),
    )
    .join('/');
  return new RegExp(`^${escaped}(/.*)?$`);
}

/** Count the literal characters leading up to the first `*` in a glob. */
function literalPrefixLength(pattern: string): number {
  const star = pattern.indexOf('*');
  return star < 0 ? pattern.length : star;
}
