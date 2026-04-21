import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

const MCP_CONFIG_FILES = [
  '.mcp.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/mcp.json',
];

function isMcpConfigFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return MCP_CONFIG_FILES.some((f) => p === f.toLowerCase() || p.endsWith('/' + f.toLowerCase()));
}

const UNSAFE_URL_PATTERNS: Array<[RegExp, string]> = [
  [
    /"(?:url|endpoint|baseUrl)"\s*:\s*"http:\/\//i,
    'Plain http:// MCP endpoint — traffic unencrypted.',
  ],
  [
    /"(?:url|endpoint|baseUrl|command)"\s*:\s*"file:\/\/\//i,
    'file:/// URL references a local path — confirm it is inside the project.',
  ],
  [
    /"(?:url|endpoint|baseUrl)"\s*:\s*"https?:\/\/xn--/i,
    'Punycode hostname — possible IDN homograph attack.',
  ],
  [
    /"(?:url|endpoint|baseUrl)"\s*:\s*"https?:\/\/[^"]*[а-яА-Я]/,
    'Cyrillic characters in hostname — possible mixed-script homograph.',
  ],
];

/**
 * security/mcp-url-scheme
 *
 * Blocks MCP config writes that register servers over unsafe URL schemes
 * or hostnames: plain http://, out-of-project file:///, punycode domains,
 * and mixed-script (Cyrillic/Latin) hostnames. Addresses MCP transport
 * layer security (Section 7 of the MCP research brief).
 */
export const mcpUrlScheme: Rule = {
  id: 'security/mcp-url-scheme',
  name: 'MCP URL Scheme',
  description: 'Blocks MCP servers configured with unsafe URL schemes or homograph-prone hosts.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/mcp-url-scheme';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };
    if (!isMcpConfigFile(filePath)) return { status: 'pass', ruleId };

    for (const [pattern, message] of UNSAFE_URL_PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'block',
          ruleId,
          message,
          fix: 'Use HTTPS URLs with canonical ASCII hostnames. For local stdio servers, use a "command" field, not file:/// URLs.',
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
