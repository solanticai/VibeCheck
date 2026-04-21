import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

const configSchema = z.object({
  allowedServers: z.array(z.string()).optional(),
  configFiles: z.array(z.string()).optional(),
});

const DEFAULT_CONFIG_FILES = [
  '.mcp.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/mcp.json',
  '.codex/config.toml',
  '.codex/config.json',
];

function isMcpConfigFile(filePath: string, configFiles: string[]): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return configFiles.some((f) => {
    const needle = normalizePath(f).toLowerCase();
    return normalized === needle || normalized.endsWith('/' + needle);
  });
}

function extractMcpServerNames(content: string): string[] {
  const names: string[] = [];
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const mcpServers =
      (parsed?.mcpServers as Record<string, unknown> | undefined) ??
      ((parsed?.mcp as Record<string, unknown> | undefined)?.servers as
        | Record<string, unknown>
        | undefined);
    if (mcpServers && typeof mcpServers === 'object') {
      names.push(...Object.keys(mcpServers));
    }
  } catch {
    const matches = content.match(/"([\w-]+)"\s*:\s*\{[^}]*"(?:command|url|transport)"/g);
    if (matches) {
      for (const m of matches) {
        const n = m.match(/^"([\w-]+)"/);
        if (n?.[1]) names.push(n[1]);
      }
    }
  }
  return names;
}

/**
 * security/mcp-server-allowlist
 *
 * Blocks writes to MCP config files (.mcp.json, .claude/settings.json,
 * .cursor/mcp.json, etc.) that register servers not in the configured
 * allowlist. Maps to OWASP Agentic ASI04 (Agentic Supply Chain) and the
 * Claude Code RCE chain CVE-2025-59536 (project-level config executing
 * arbitrary commands on open).
 */
export const mcpServerAllowlist: Rule = {
  id: 'security/mcp-server-allowlist',
  name: 'MCP Server Allowlist',
  description:
    'Blocks MCP config writes that register servers not present in the configured allowlist.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/mcp-server-allowlist';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const configFiles = (ruleConfig?.options?.configFiles as string[]) ?? DEFAULT_CONFIG_FILES;
    const allowed = (ruleConfig?.options?.allowedServers as string[]) ?? [];

    if (!isMcpConfigFile(filePath, configFiles)) return { status: 'pass', ruleId };

    const servers = extractMcpServerNames(content);
    if (servers.length === 0) return { status: 'pass', ruleId };

    const disallowed = servers.filter((s) => !allowed.includes(s));
    if (disallowed.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `MCP server registration blocked: ${disallowed.join(', ')} not in allowlist.`,
      fix: `Add the server(s) to rule options.allowedServers in vguard.config.ts after reviewing the server source, or remove the entry. Unknown MCP servers can inject instructions into every tool call (see Check Point CVE-2025-59536).`,
      metadata: { filePath, disallowed, allowed },
    };
  },
};
