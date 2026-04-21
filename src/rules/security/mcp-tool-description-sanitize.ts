import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

const INJECTION_IN_DESC: RegExp[] = [
  /description\s*:\s*[`'"][^`'"]*(?:ignore\s+previous|you\s+are\s+now|<\|im_start\|>|\[\[\s*system)/i,
  /description\s*:\s*[`'"][^`'"]*[\u200B-\u200F\u202A-\u202E]/,
];

function isMcpServerFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return /\bmcp[-_]?server|\/server\.(?:ts|js|py)$|\/tools\//i.test(p);
}

/**
 * security/mcp-tool-description-sanitize (mcp-server preset)
 *
 * Blocks MCP server source that embeds prompt-injection markers in tool
 * descriptions. Tool descriptions are read by clients at registration
 * time as authoritative system guidance, so injection markers there
 * poison every consumer.
 */
export const mcpToolDescriptionSanitize: Rule = {
  id: 'mcp/tool-description-sanitize',
  name: 'MCP Tool Description Sanitize',
  description: 'Blocks prompt-injection markers in MCP tool description fields.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'mcp/tool-description-sanitize';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'mjs', 'cjs', 'py', 'json'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (!isMcpServerFile(filePath)) return { status: 'pass', ruleId };

    const hit = INJECTION_IN_DESC.find((p) => p.test(content));
    if (!hit) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: 'MCP tool description contains prompt-injection markers.',
      fix: 'Tool descriptions are parsed by clients as authoritative instruction. Remove "ignore previous", "you are now", zero-width chars, and similar markers.',
    };
  },
};
