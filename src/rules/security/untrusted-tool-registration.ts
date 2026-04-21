import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  allowedServers: z.array(z.string()).optional(),
});

const MCP_INSTALL_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
  [/\bclaude\s+mcp\s+add\s+(?:--\w+\s+\S+\s+)*([^\s]+)/i, (m) => m[1] ?? null],
  [/\bcursor\s+mcp\s+(?:install|add)\s+([^\s]+)/i, (m) => m[1] ?? null],
  [/\bnpx\s+mcp-install\s+([^\s]+)/i, (m) => m[1] ?? null],
  [/\bmcp\s+install\s+([^\s]+)/i, (m) => m[1] ?? null],
];

/**
 * security/untrusted-tool-registration
 *
 * Blocks Bash commands that register MCP servers at runtime unless the
 * server name/URL appears in the configured allowlist. Runtime
 * registration bypasses the MCP config files, so `security/mcp-server-
 * allowlist` would not catch it.
 */
export const untrustedToolRegistration: Rule = {
  id: 'security/untrusted-tool-registration',
  name: 'Untrusted Tool Registration',
  description: 'Blocks runtime MCP registration commands targeting non-allowlisted servers.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/untrusted-tool-registration';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const cfg = context.projectConfig.rules.get(ruleId);
    const allowed = (cfg?.options?.allowedServers as string[] | undefined) ?? [];

    for (const [pattern, extract] of MCP_INSTALL_PATTERNS) {
      const m = command.match(pattern);
      if (!m) continue;
      const target = extract(m);
      if (!target) continue;
      const normalised = target.toLowerCase();
      const isAllowed = allowed.some(
        (a) => normalised === a.toLowerCase() || normalised.includes(a.toLowerCase()),
      );
      if (isAllowed) return { status: 'pass', ruleId };

      return {
        status: 'block',
        ruleId,
        message: `Runtime MCP registration of "${target}" blocked — not in allowlist.`,
        fix: 'Add the server to security/untrusted-tool-registration.options.allowedServers in vguard.config.ts after reviewing the server source. Unknown MCP servers can poison every tool call.',
        metadata: { target, allowed },
      };
    }

    return { status: 'pass', ruleId };
  },
};
