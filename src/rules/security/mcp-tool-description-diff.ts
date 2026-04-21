import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  hashFile: z.string().optional(),
});

const DEFAULT_HASH_FILE = '.vguard/data/mcp-tool-hashes.json';

interface HashStore {
  servers: Record<string, { hash: string; firstSeen: string; lastSeen: string }>;
}

function readStore(path: string): HashStore {
  try {
    if (!existsSync(path)) return { servers: {} };
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as HashStore;
    return parsed && typeof parsed === 'object'
      ? { servers: parsed.servers ?? {} }
      : { servers: {} };
  } catch {
    return { servers: {} };
  }
}

function writeStore(path: string, store: HashStore): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Non-fatal
  }
}

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

/**
 * security/mcp-tool-description-diff
 *
 * Hashes MCP server tool descriptions from session payloads and compares
 * against the last stored hash. Warns if any description has changed since
 * the last session — defeats rug-pull attacks where an MCP server
 * silently mutates its tool descriptions after install. Stores hashes at
 * .vguard/data/mcp-tool-hashes.json.
 *
 * NOTE: Relies on the hook runner surfacing MCP tool metadata on the
 * Stop event via context.toolInput. When absent, the rule is a no-op.
 */
export const mcpToolDescriptionDiff: Rule = {
  id: 'security/mcp-tool-description-diff',
  name: 'MCP Tool Description Diff',
  description:
    "Warns when an MCP server's tool descriptions change between sessions (detects rug-pulls).",
  severity: 'warn',
  events: ['Stop'],
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/mcp-tool-description-diff';

    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };

      const ruleConfig = context.projectConfig.rules.get(ruleId);
      const hashFileRel = (ruleConfig?.options?.hashFile as string) ?? DEFAULT_HASH_FILE;
      const hashFile = join(repoRoot, hashFileRel);

      // Input shape: toolInput.mcpServers = { name: { tools: [{name, description}, ...] } }
      const mcpServers = context.toolInput?.mcpServers as
        | Record<string, { tools?: Array<{ name?: string; description?: string }> }>
        | undefined;
      if (!mcpServers || typeof mcpServers !== 'object') return { status: 'pass', ruleId };

      const store = readStore(hashFile);
      const now = new Date().toISOString();
      const changed: Array<{ server: string; from: string; to: string }> = [];
      const next: HashStore = { servers: { ...store.servers } };

      for (const [serverName, server] of Object.entries(mcpServers)) {
        const tools = server?.tools ?? [];
        if (tools.length === 0) continue;
        const canonical = tools
          .map((t) => `${t.name ?? ''}::${t.description ?? ''}`)
          .sort()
          .join('\n');
        const currentHash = hashText(canonical);
        const prev = store.servers[serverName];
        if (prev) {
          if (prev.hash !== currentHash) {
            changed.push({ server: serverName, from: prev.hash, to: currentHash });
          }
          next.servers[serverName] = { ...prev, hash: currentHash, lastSeen: now };
        } else {
          next.servers[serverName] = { hash: currentHash, firstSeen: now, lastSeen: now };
        }
      }

      writeStore(hashFile, next);

      if (changed.length === 0) return { status: 'pass', ruleId };

      return {
        status: 'warn',
        ruleId,
        message: `MCP tool descriptions changed on: ${changed.map((c) => c.server).join(', ')}.`,
        fix: 'Review each changed server. Silent post-install description changes are a known rug-pull pattern — they can inject instructions into the agent context. Investigate the server source before continuing.',
        metadata: { changed },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
