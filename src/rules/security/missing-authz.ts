import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

const HANDLER_MARKERS = [
  /\b(?:export\s+(?:async\s+)?(?:function|const)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS))\b/,
  /\brouter\.(?:get|post|put|patch|delete)\s*\(/,
  /\bapp\.(?:get|post|put|patch|delete)\s*\(/,
  /@(?:Get|Post|Put|Patch|Delete)\s*\(/,
];

const USER_INPUT_MARKERS = [
  /\breq\.(?:params|query|body)\.[a-zA-Z_]\w*/,
  /\brequest\.(?:params|query|body)\.[a-zA-Z_]\w*/,
  /\bsearchParams\.get\s*\(/,
  /\bparams\.[a-zA-Z_]\w*/,
];

const AUTH_MARKERS = [
  /\brequireAuth\b/,
  /\bgetSession\b/,
  /\bauthorize\b/,
  /\bcheckAuth\b/,
  /\buseUser\b/,
  /\bauthMiddleware\b/,
  /@UseGuards\s*\(/,
  /\bgetServerSession\b/,
];

function isApiOrRouteFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return /\/(api|routes?|handlers?|controllers?|resolvers?)\//.test(p);
}

/**
 * security/missing-authz (CWE-862)
 *
 * Heuristic: if a file lives under api|routes|handlers|controllers,
 * exports an HTTP handler, references user input (req.params/query/body),
 * and does NOT import any recognisable auth helper, warn. False-positive-
 * prone by design — severity `warn`.
 */
export const missingAuthz: Rule = {
  id: 'security/missing-authz',
  name: 'Missing Authorization',
  description: 'Warns when an API/route handler references user input without an auth helper.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/missing-authz';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };
    if (!isApiOrRouteFile(filePath)) return { status: 'pass', ruleId };

    const hasHandler = HANDLER_MARKERS.some((p) => p.test(content));
    if (!hasHandler) return { status: 'pass', ruleId };

    const touchesUserInput = USER_INPUT_MARKERS.some((p) => p.test(content));
    if (!touchesUserInput) return { status: 'pass', ruleId };

    const hasAuth = AUTH_MARKERS.some((p) => p.test(content));
    if (hasAuth) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message:
        'API handler references user input (req.params/query/body) but no recognisable auth helper is present.',
      fix: 'Add an auth guard: e.g. const session = await getServerSession(); if (!session) return unauthorized(); or @UseGuards(AuthGuard) in NestJS.',
      metadata: { filePath },
    };
  },
};
