import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  allowedOrigins: z.array(z.string()).optional(),
  ragDestinations: z.array(z.string()).optional(),
});

const DEFAULT_RAG_DESTINATIONS = [
  '.vguard/memory/',
  '.claude/memory/',
  '.cursor/rules/',
  'knowledge/',
  'docs/ingested/',
];

/**
 * security/rag-source-allowlist
 *
 * Warns when a WebFetch / Read targets content that will subsequently be
 * indexed into a local RAG/memory directory, AND the source origin is
 * not in the configured allowlist. Addresses OWASP LLM04 (Data/Model
 * Poisoning) at the ingestion boundary.
 */
export const ragSourceAllowlist: Rule = {
  id: 'security/rag-source-allowlist',
  name: 'RAG Source Allowlist',
  description:
    'Warns when content ingested into a RAG/memory directory originates from a non-allowlisted source.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['WebFetch', 'Read', 'Write'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/rag-source-allowlist';
    const tool = context.tool;
    const cfg = context.projectConfig.rules.get(ruleId);
    const allowed = ((cfg?.options?.allowedOrigins as string[]) ?? []).map((s) => s.toLowerCase());
    const destinations = (cfg?.options?.ragDestinations as string[]) ?? DEFAULT_RAG_DESTINATIONS;

    if (tool === 'Write') {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!destinations.some((d) => filePath.includes(d))) return { status: 'pass', ruleId };
      const content = (context.toolInput.content as string) ?? '';
      // Look for source URLs in frontmatter or first 500 chars
      const head = content.slice(0, 500);
      const urlMatch = head.match(/https?:\/\/([a-zA-Z0-9.-]+)/i);
      if (!urlMatch) return { status: 'pass', ruleId };
      const host = urlMatch[1]?.toLowerCase() ?? '';
      if (allowed.length === 0) return { status: 'pass', ruleId };
      if (allowed.some((a) => host === a || host.endsWith('.' + a))) {
        return { status: 'pass', ruleId };
      }
      return {
        status: 'warn',
        ruleId,
        message: `Writing to RAG/memory path "${filePath}" with content from non-allowlisted host "${host}".`,
        fix: 'Add the host to security/rag-source-allowlist.options.allowedOrigins, or fetch from an allowlisted mirror/snapshot.',
        metadata: { host, filePath },
      };
    }

    return { status: 'pass', ruleId };
  },
};
