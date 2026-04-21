import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

type Finding = 'literal-secret-in-jwt-verify' | 'jwt-alg-none' | 'jwt-decode-without-verify';

const PATTERNS: Array<[RegExp, Finding, string]> = [
  [
    /jwt\.verify\s*\([^,]+,\s*['"`][^'"`]+['"`]/,
    'literal-secret-in-jwt-verify',
    'jwt.verify with a literal string as the secret — use process.env or a KMS.',
  ],
  [
    /algorithm\s*:\s*['"`]none['"`]/i,
    'jwt-alg-none',
    'JWT algorithm: "none" — accepts unsigned tokens.',
  ],
];

const DECODE_PATTERN = /\bjwt\.decode\s*\(/g;
const VERIFY_PATTERN = /\bjwt\.verify\s*\(/;

/**
 * Walk backwards from `decodeIndex` to find the opening `{` of the
 * enclosing function scope, then forward-scan with brace balancing to
 * find the matching `}`. Returns the [start,end] character indices of the
 * enclosing block, or null if we can't identify one (e.g. module-level
 * decode call).
 */
function findEnclosingBlock(content: string, decodeIndex: number): [number, number] | null {
  // Walk backwards to find a candidate `{` that opens the enclosing scope.
  // Track brace balance: every `}` we pass going backwards adds to depth;
  // every `{` subtracts. When depth < 0, that `{` opens our scope.
  let depth = 0;
  let openIndex = -1;
  for (let i = decodeIndex - 1; i >= 0; i--) {
    const ch = content[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        openIndex = i;
        break;
      }
      depth--;
    }
  }
  if (openIndex === -1) return null;

  // Forward-scan from openIndex to find the matching close.
  let forwardDepth = 0;
  for (let i = openIndex; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') forwardDepth++;
    else if (ch === '}') {
      forwardDepth--;
      if (forwardDepth === 0) return [openIndex, i];
    }
  }
  // Unbalanced — treat as "rest of file" to be safe.
  return [openIndex, content.length];
}

/**
 * security/jwt-validation (CWE-347)
 *
 * Flags the three most common JWT-handling mistakes:
 *   - literal secrets in jwt.verify calls,
 *   - algorithm=none acceptance,
 *   - jwt.decode used without jwt.verify in the SAME function scope.
 *
 * Function-scope detection (rather than file-global) means a util module
 * that decodes token A and verifies token B in separate functions is
 * correctly flagged for the unsafe decode, while a single function that
 * decodes then verifies before trusting the result is not.
 */
export const jwtValidation: Rule = {
  id: 'security/jwt-validation',
  name: 'JWT Validation',
  description: 'Blocks common JWT validation mistakes (literal secret, alg=none, decode-only).',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/jwt-validation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    const fix =
      'Use jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"], issuer, audience }). Never use alg=none. Never trust jwt.decode output without a verify call in the same function.';

    // 1. Single-regex patterns (literal-secret, alg=none).
    for (const [pattern, id, message] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'block',
          ruleId,
          message,
          fix,
          metadata: { finding: id },
        };
      }
    }

    // 2. decode-without-verify: function-scope check.
    DECODE_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DECODE_PATTERN.exec(content)) !== null) {
      const decodeIndex = m.index;
      const block = findEnclosingBlock(content, decodeIndex);
      if (!block) {
        // Module-level decode — fall back to a file-wide check (unchanged
        // conservative behaviour) so a top-level `const c = jwt.decode(t);`
        // in a utility module still gets flagged.
        if (!VERIFY_PATTERN.test(content)) {
          return {
            status: 'block',
            ruleId,
            message:
              'jwt.decode used at module scope without any corresponding jwt.verify — returns claims without signature check.',
            fix,
            metadata: { finding: 'jwt-decode-without-verify', scope: 'module' },
          };
        }
        continue;
      }

      const [start, end] = block;
      const scope = content.slice(start, end);
      if (!VERIFY_PATTERN.test(scope)) {
        return {
          status: 'block',
          ruleId,
          message:
            'jwt.decode used without a corresponding jwt.verify in the same function — returns claims without signature check.',
          fix,
          metadata: { finding: 'jwt-decode-without-verify', scope: 'function' },
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
