import type { Preset } from '../types.js';

/**
 * MCP Server preset — for projects *building* MCP servers.
 *
 * Addresses the April 2026 MCP STDIO design-flaw disclosure and the
 * 50+ catalogued MCP CVEs in Q1 2026. Bundles the four `mcp/*` rules
 * (server-side authoring) plus the top-tier client-side MCP rules
 * (`mcp-server-allowlist`, `mcp-credential-scope`, `mcp-tool-description-
 * diff`, `mcp-url-scheme`) so authors running their dev agent with this
 * preset catch both classes of issue.
 */
export const mcpServer: Preset = {
  id: 'mcp-server',
  name: 'MCP Server',
  description:
    'Building / operating MCP servers: STDIO command hardening, tool-description sanitisation, allowlisted registration.',
  version: '1.0.0',
  rules: {
    'mcp/stdio-command-validation': true,
    'mcp/no-dynamic-tool-registration': true,
    'mcp/tool-description-sanitize': true,
    'mcp/capability-disclosure': true,
    'security/mcp-server-allowlist': true,
    'security/mcp-credential-scope': true,
    'security/mcp-tool-description-diff': true,
    'security/mcp-url-scheme': true,
    'security/agentsmd-integrity': true,
    'security/untrusted-tool-registration': true,
    'security/secret-detection': true,
    'security/sql-injection': true,
    'security/unsafe-eval': true,
  },
};
