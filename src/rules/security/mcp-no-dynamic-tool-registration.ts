import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

const HANDLER_MARKERS: RegExp[] = [
  /\bserver\.setRequestHandler\s*\(/,
  /\bserver\.(?:onRequest|on)\s*\(/,
  /\b@server\.tool\b/,
];

const REGISTRATION_CALLS: RegExp[] = [
  /\bserver\.addTool\s*\(/,
  /\bserver\.registerTool\s*\(/,
  /\bserver\.removeTool\s*\(/,
];

function isMcpServerFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return /\bmcp[-_]?server|\/server\.(?:ts|js|py)$|\/tools\//i.test(p);
}

/**
 * security/mcp-no-dynamic-tool-registration (mcp-server preset)
 *
 * Warns when an MCP server calls `server.addTool` / `server.registerTool`
 * / `server.removeTool` from inside a request handler. Dynamic tool
 * registration during a session is an attack surface for rug-pulls and
 * confused-deputy abuse.
 */
export const mcpNoDynamicToolRegistration: Rule = {
  id: 'mcp/no-dynamic-tool-registration',
  name: 'MCP No Dynamic Tool Registration',
  description: 'Warns when MCP tool registration happens inside a request handler.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'mcp/no-dynamic-tool-registration';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'mjs', 'cjs', 'py'].includes(ext)) return { status: 'pass', ruleId };
    if (!isMcpServerFile(filePath)) return { status: 'pass', ruleId };

    // Look for handler markers followed by a registration call within 1000 chars
    for (const handlerRe of HANDLER_MARKERS) {
      handlerRe.lastIndex = 0;
      const match = handlerRe.exec(content);
      if (!match) continue;
      const window = content.slice(match.index, match.index + 1000);
      const reg = REGISTRATION_CALLS.find((p) => p.test(window));
      if (reg) {
        return {
          status: 'warn',
          ruleId,
          message: 'MCP tool registration appears inside a request handler — ships dynamically.',
          fix: 'Register all tools once at server startup. Dynamic registration is a rug-pull vector and undermines clients that cache the tool list.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
