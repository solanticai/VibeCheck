import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';
import { validateUserRegex } from '../../utils/validate-regex.js';

const configSchema = z.object({
  configFiles: z.array(z.string()).optional(),
  secretNamePattern: z.string().optional(),
});

const DEFAULT_CONFIG_FILES = [
  '.mcp.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.cursor/mcp.json',
];

const DEFAULT_SECRET_NAME_PATTERN = '(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API|AUTH|PRIVATE)';

function isMcpConfigFile(filePath: string, configFiles: string[]): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return configFiles.some((f) => {
    const needle = normalizePath(f).toLowerCase();
    return normalized === needle || normalized.endsWith('/' + needle);
  });
}

function collectEnvKeys(content: string): string[] {
  const keys: string[] = [];
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const servers =
      (parsed?.mcpServers as Record<string, unknown> | undefined) ??
      ((parsed?.mcp as Record<string, unknown> | undefined)?.servers as
        | Record<string, unknown>
        | undefined);
    if (servers && typeof servers === 'object') {
      for (const server of Object.values(servers)) {
        const env = (server as { env?: unknown })?.env;
        if (env && typeof env === 'object') {
          keys.push(...Object.keys(env as Record<string, unknown>));
        }
      }
    }
  } catch {
    const matches = content.match(/"env"\s*:\s*\{([^}]+)\}/g);
    if (matches) {
      for (const m of matches) {
        const names = m.match(/"([A-Z_][A-Z0-9_]*)"\s*:/g);
        if (names) keys.push(...names.map((n) => n.replace(/[":\s]/g, '')));
      }
    }
  }
  return keys;
}

/**
 * security/mcp-credential-scope
 *
 * Warns when an MCP server configuration exposes env variables whose names
 * look secret-shaped (KEY, TOKEN, SECRET, PASSWORD, etc.). MCP servers
 * inherit the full process env by default; explicit per-server scoping is
 * safer than ambient access. Maps to OWASP Agentic ASI03 and CVE-2026-21852.
 */
export const mcpCredentialScope: Rule = {
  id: 'security/mcp-credential-scope',
  name: 'MCP Credential Scope',
  description: 'Warns when MCP server env exposes secret-shaped variable names.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/mcp-credential-scope';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const configFiles = (ruleConfig?.options?.configFiles as string[]) ?? DEFAULT_CONFIG_FILES;
    const patternStr =
      (ruleConfig?.options?.secretNamePattern as string) ?? DEFAULT_SECRET_NAME_PATTERN;

    if (!isMcpConfigFile(filePath, configFiles)) return { status: 'pass', ruleId };

    let pattern: RegExp;
    try {
      pattern = validateUserRegex(patternStr, 'i', { label: `${ruleId}.secretNamePattern` });
    } catch {
      return { status: 'pass', ruleId };
    }

    const keys = collectEnvKeys(content);
    const secretKeys = keys.filter((k) => pattern.test(k));
    if (secretKeys.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `MCP server env exposes secret-shaped keys: ${secretKeys.join(', ')}.`,
      fix: 'Scope MCP server credentials explicitly. Prefer per-server secret files or OS keychain injection over ambient process env, and avoid exposing broad API keys to multiple servers.',
      metadata: { filePath, secretKeys },
    };
  },
};
