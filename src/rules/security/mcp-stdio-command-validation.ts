import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

const UNSAFE_EXEC_PATTERNS: RegExp[] = [
  /\bchild_process\.(?:exec|execSync)\s*\([^)]*\$\{/,
  /\bexecSync\s*\([^)]*\$\{/,
  /\bspawn\s*\(\s*['"`][^'"`]*['"`]\s*,\s*\[[^\]]*\$\{/,
  /\bBun\.\$`[^`]*\$\{/,
  /\bos\.system\s*\([^)]*\bf?["'][^"']*\{/,
];

function isMcpServerFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return (
    /\bmcp[-_]?server/i.test(p) ||
    /\/server\.(?:ts|js|py)$/i.test(p) ||
    /\/tools\/.+\.(?:ts|js|py)$/i.test(p)
  );
}

/**
 * security/mcp-stdio-command-validation (mcp-server preset)
 *
 * Blocks MCP-server handler code that passes tool-call arguments into
 * `child_process.exec`, Bun's `$`, or Python `os.system` via string
 * interpolation. This is the ASI05 RCE chain that the April 2026 MCP
 * STDIO design-flaw disclosure targets.
 */
export const mcpStdioCommandValidation: Rule = {
  id: 'mcp/stdio-command-validation',
  name: 'MCP STDIO Command Validation',
  description: 'Blocks MCP tool handlers that feed tool-call args into unsafe exec sinks.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'mcp/stdio-command-validation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'mjs', 'cjs', 'py'].includes(ext)) return { status: 'pass', ruleId };
    if (!isMcpServerFile(filePath)) return { status: 'pass', ruleId };

    const hit = UNSAFE_EXEC_PATTERNS.find((p) => p.test(content));
    if (!hit) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message:
        'MCP server handler passes tool arguments into an exec sink via string interpolation.',
      fix: 'Never interpolate tool-call arguments into a shell string. Use execFile/spawn with an argv array, and validate args against a strict schema first.',
    };
  },
};
