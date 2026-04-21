import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

function isMcpServerEntry(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return /\/(?:server|index|main)\.(?:ts|js|py)$/i.test(p);
}

/**
 * security/mcp-capability-disclosure (mcp-server preset)
 *
 * Warns when an MCP server entry file instantiates a server without a
 * `capabilities` argument. Explicit capability declaration is a 2026 MCP
 * protocol best practice and enables clients to display expected scope
 * at install time.
 */
export const mcpCapabilityDisclosure: Rule = {
  id: 'mcp/capability-disclosure',
  name: 'MCP Capability Disclosure',
  description: 'Warns when an MCP Server is constructed without an explicit capabilities object.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'mcp/capability-disclosure';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'mjs', 'cjs', 'py'].includes(ext)) return { status: 'pass', ruleId };
    if (!isMcpServerEntry(filePath)) return { status: 'pass', ruleId };

    // new Server({ ... }) / Server(...) calls present?
    if (!/\b(?:new\s+)?(?:Mcp)?Server\s*\(/.test(content)) return { status: 'pass', ruleId };

    if (/\bcapabilities\s*:/.test(content)) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: 'MCP Server constructed without an explicit `capabilities` declaration.',
      fix: 'Pass a `capabilities: { tools: {}, resources: {}, prompts: {} }` object (with only the features you implement) so clients can display scope at install time.',
    };
  },
};
