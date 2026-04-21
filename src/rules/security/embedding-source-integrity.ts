import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  manifestFile: z.string().optional(),
});

const DEFAULT_MANIFEST = '.vguard/embeddings-manifest.json';

const EMBED_COMMAND_PATTERNS: RegExp[] = [
  /\b(?:embed|vectorize|index)\s+[^\n]*--(?:input|source|dir)\b/i,
  /\bllamaindex\s+(?:load|ingest)/i,
  /\bchroma\s+(?:add|upsert)/i,
  /\bpython\s+[^\n]*\b(?:embed|ingest|index)\.py\b/i,
];

/**
 * security/embedding-source-integrity
 *
 * Warns when an embedding/indexing command is run without a present
 * manifest file that pins source hashes. Addresses OWASP LLM08 (Vector
 * and Embedding Weaknesses) — poisoned retrieval is invisible without
 * source integrity control.
 */
export const embeddingSourceIntegrity: Rule = {
  id: 'security/embedding-source-integrity',
  name: 'Embedding Source Integrity',
  description: 'Warns when embedding/indexing commands run without a source-integrity manifest.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/embedding-source-integrity';
    const command = (context.toolInput.command as string) ?? '';
    const repoRoot = context.gitContext.repoRoot;
    if (!command || !repoRoot) return { status: 'pass', ruleId };

    const isEmbedCmd = EMBED_COMMAND_PATTERNS.some((p) => p.test(command));
    if (!isEmbedCmd) return { status: 'pass', ruleId };

    const cfg = context.projectConfig.rules.get(ruleId);
    const manifestFile = (cfg?.options?.manifestFile as string) ?? DEFAULT_MANIFEST;
    if (existsSync(join(repoRoot, manifestFile))) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `Embedding/indexing command without a source-integrity manifest at ${manifestFile}.`,
      fix: `Generate a manifest that hashes each source file before ingestion: \`find ./docs -type f -exec sha256sum {} + > ${manifestFile}\`. RAG without source integrity is a poisoning vector (OWASP LLM08).`,
    };
  },
};
