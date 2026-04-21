import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PATTERNS: Array<[RegExp, string]> = [
  [
    /\bcors\s*\(\s*\)/,
    'cors() called with no options — defaults to Access-Control-Allow-Origin: *.',
  ],
  [/origin\s*:\s*['"`]\*['"`]/, 'CORS origin set to "*" — any origin can read responses.'],
  [
    /Access-Control-Allow-Origin['"`]?\s*[:,]\s*['"`]\*['"`]/,
    'Access-Control-Allow-Origin: * header set explicitly.',
  ],
  // Credentials + wildcard origin is an outright breach
  [
    /Access-Control-Allow-Credentials[^`'"]*true[\s\S]{0,400}Access-Control-Allow-Origin[^`'"]*\*/,
    'Credentials:true combined with Origin:* — browser will reject, but this is a clear configuration mistake.',
  ],
];

/**
 * security/broad-cors (CWE-942)
 *
 * Warns when CORS configuration is set to the fully-permissive default,
 * which undermines same-origin protection for authenticated endpoints.
 */
export const broadCors: Rule = {
  id: 'security/broad-cors',
  name: 'Broad CORS',
  description: 'Warns when CORS is configured with wildcard origin or credentials+wildcard.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/broad-cors';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    for (const [pattern, message] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'warn',
          ruleId,
          message,
          fix: 'Pass an explicit origin allowlist: cors({ origin: ["https://app.example.com"], credentials: true }).',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
