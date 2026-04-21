import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  lockFile: z.string().optional(),
});

const DEFAULT_LOCK_FILE = '.vguard/agent-instructions.lock';
const WATCHED_FILES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules'];

interface LockEntry {
  sha256: string;
  source?: string;
  pinnedAt?: string;
}

function readLock(path: string): Record<string, LockEntry> {
  try {
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, LockEntry>;
  } catch {
    return {};
  }
}

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * security/agentsmd-integrity
 *
 * Warns when AGENTS.md / CLAUDE.md / .cursorrules is being written with
 * content whose sha256 does not match the pinned value in
 * `.vguard/agent-instructions.lock`. Protects against CDN-served rules
 * files being silently swapped (instruction-layer rug pull).
 */
export const agentsmdIntegrity: Rule = {
  id: 'security/agentsmd-integrity',
  name: 'AGENTS.md Integrity',
  description: 'Warns when agent instruction files drift from their pinned lock-file hash.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/agentsmd-integrity';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };

    const repoRoot = context.gitContext.repoRoot;
    if (!repoRoot) return { status: 'pass', ruleId };

    const file = filePath.split(/[\\/]/).pop() ?? '';
    if (!WATCHED_FILES.includes(file)) return { status: 'pass', ruleId };

    const cfg = context.projectConfig.rules.get(ruleId);
    const lockPath = (cfg?.options?.lockFile as string) ?? DEFAULT_LOCK_FILE;
    const lock = readLock(join(repoRoot, lockPath));
    const entry = lock[file];
    if (!entry) return { status: 'pass', ruleId }; // no pin — rule is advisory only

    const actual = hashText(content);
    if (actual === entry.sha256) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `${file} hash mismatch vs ${lockPath}. The file may have been tampered with.`,
      fix: `If this change is expected, regenerate the lock: \`echo '{"${file}":{"sha256":"${actual}"}}' > ${lockPath}\`. Otherwise investigate the source — CDN-served instruction files can be a rug-pull vector.`,
      metadata: { file, expected: entry.sha256, actual },
    };
  },
};
