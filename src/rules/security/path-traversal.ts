import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PATTERNS: Array<[RegExp, string]> = [
  [
    /\bpath\.join\s*\([^)]*req\.(?:params|query|body)\b/,
    'path.join with req.params/query/body as argument — user input flows into file path without allowlist.',
  ],
  [
    /\bfs\.(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream|createWriteStream|unlink|unlinkSync)\s*\([^)]*req\.(?:params|query|body)\b/,
    'fs call with req.* in path — attacker-controlled filename.',
  ],
  [
    /\bopen\s*\(\s*(?:request|flask\.request|req)\.[^)]*\)/,
    'open() with request data — path traversal risk.',
  ],
  [
    /\b(?:send_file|sendfile)\s*\(\s*(?:request|flask\.request|req)\.[^)]*\)/,
    'send_file with user input — path traversal risk.',
  ],
];

/**
 * security/path-traversal (CWE-22)
 *
 * Flags code that concatenates request-derived input directly into
 * file-system paths without normalisation or allowlisting. Common in
 * AI-generated upload and download handlers.
 */
export const pathTraversal: Rule = {
  id: 'security/path-traversal',
  name: 'Path Traversal Prevention',
  description: 'Blocks file-system calls that use request input directly in paths.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/path-traversal';
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
          status: 'block',
          ruleId,
          message,
          fix: 'Validate and normalise the path: resolve against a base directory, reject paths containing ".." after normalisation, and check the result starts with the expected prefix.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
