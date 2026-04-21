/**
 * Validate a user-supplied regex source for ReDoS risk and compile it.
 *
 * Catastrophic backtracking is caused by ambiguous alternation / nested
 * unbounded quantifiers — `(a+)+b`, `(a|a)+b`, `^(([a-z])+.)+[A-Z]` etc.
 * A single fire against a moderate input can hang a hook for seconds to
 * minutes, violating VGuard's "never block developer flow" contract.
 *
 * This validator combines two cheap checks:
 *
 *  1. A structural heuristic that rejects patterns containing nested
 *     unbounded quantifiers applied to groups — the shape behind every
 *     well-known ReDoS PoC. Not exhaustive, but covers the class.
 *  2. A time-boxed smoke test against a known pathological input
 *     (`'a'.repeat(40) + '!'`) with a 20 ms budget.
 *
 * Either check failing produces a thrown error. Rules that take user
 * regex MUST route through this helper; catching directly with
 * `new RegExp(...)` re-opens the hang.
 */

const MAX_SMOKE_MS = 20;
const SMOKE_INPUT = 'a'.repeat(40) + '!';

/**
 * Structural check for nested unbounded quantifiers on a group.
 * Matches shapes like:
 *   (...)+  ... +
 *   (...)*  ... *
 *   (...)?  ... +
 * where the inner `...` itself contains `+`, `*`, or `{n,}`.
 *
 * Using string inspection rather than AST parsing keeps the helper
 * dependency-free and good enough for the common red-flag shapes.
 */
function hasNestedUnboundedQuantifier(source: string): boolean {
  // Walk groups and check whether any group that contains an unbounded
  // inner quantifier is itself followed by an unbounded outer quantifier.
  let depth = 0;
  const groupStarts: number[] = [];
  const groupHasInnerUnbounded: boolean[] = [];

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') {
      i++; // skip escaped char
      continue;
    }
    if (ch === '(') {
      depth++;
      groupStarts.push(i);
      groupHasInnerUnbounded.push(false);
      continue;
    }
    if (ch === ')') {
      const hadInner = groupHasInnerUnbounded.pop() ?? false;
      groupStarts.pop();
      depth--;
      const next = source[i + 1];
      const openBrace = source.indexOf('{', i + 1) === i + 1;
      const outerUnbounded =
        next === '+' || next === '*' || (openBrace && /^\{\d+,\s*\}/.test(source.slice(i + 1)));
      if (hadInner && outerUnbounded) return true;
      continue;
    }
    if (depth > 0 && (ch === '+' || ch === '*')) {
      groupHasInnerUnbounded[groupHasInnerUnbounded.length - 1] = true;
      continue;
    }
    if (depth > 0 && ch === '{') {
      const close = source.indexOf('}', i);
      if (close > 0 && /^\{\d+,\s*\}$/.test(source.slice(i, close + 1))) {
        groupHasInnerUnbounded[groupHasInnerUnbounded.length - 1] = true;
      }
    }
  }

  return false;
}

/**
 * Run the compiled regex against a pathological input under a millisecond
 * budget. A single `test()` call is synchronous — we can only time it and
 * log; we cannot kill a truly stuck engine. This catch is therefore for
 * nearly-pathological patterns that still complete, flagging them before
 * they ship into hooks where they'd fire many times per session.
 */
function smokeTest(re: RegExp): void {
  const start = Date.now();
  re.test(SMOKE_INPUT);
  const elapsed = Date.now() - start;
  if (elapsed > MAX_SMOKE_MS) {
    throw new Error(
      `regex took ${elapsed}ms on a 40-char smoke input — likely catastrophic backtracking`,
    );
  }
}

export interface ValidateRegexOptions {
  /** Identifier shown in error messages (rule id + option key). */
  label?: string;
}

/**
 * Compile `source` under `flags` after the safety checks.
 * Throws with a label-prefixed, human-readable message on failure.
 */
export function validateUserRegex(
  source: string,
  flags = '',
  options: ValidateRegexOptions = {},
): RegExp {
  const label = options.label ?? 'user regex';

  if (hasNestedUnboundedQuantifier(source)) {
    throw new Error(
      `${label}: pattern /${source}/ contains a nested unbounded quantifier ` +
        '(ReDoS risk). Rewrite without repeated groups like `(a+)+` or `(...)+*`.',
    );
  }

  let re: RegExp;
  try {
    re = new RegExp(source, flags);
  } catch (err) {
    throw new Error(
      `${label}: invalid regex /${source}/ — ${err instanceof Error ? err.message : 'parse error'}`,
      { cause: err },
    );
  }

  try {
    smokeTest(re);
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : 'smoke test failed'}`, {
      cause: err,
    });
  }

  return re;
}
