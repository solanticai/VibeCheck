import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

const configSchema = z.object({
  paths: z.array(z.string()).optional(),
  allowEnv: z.string().optional(),
});

const DEFAULT_PROTECTED_PATHS = [
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.cursor/rules/',
  '.claude/memory/',
  '.claude/rules/',
  '.claude/settings.json',
  '.opencode/',
  '.codex/',
  '.mcp.json',
];

const DEFAULT_ALLOW_ENV = 'VGUARD_MEMORY_OK';

function isProtected(filePath: string, protectedPaths: string[]): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return protectedPaths.some((p) => {
    const needle = normalizePath(p).toLowerCase();
    if (needle.endsWith('/')) {
      return normalized.includes('/' + needle) || normalized.endsWith(needle);
    }
    return normalized === needle || normalized.endsWith('/' + needle);
  });
}

/**
 * security/memory-file-write-guard
 *
 * Blocks agent writes to persistent memory / rules files (CLAUDE.md,
 * AGENTS.md, .cursorrules, .cursor/rules, .claude/memory/, .mcp.json, etc.)
 * unless the configured escape-hatch env var is set. Protects against
 * persistent guardrail bypass via context poisoning. Maps to OWASP
 * Agentic ASI06 (Memory & Context Poisoning).
 */
export const memoryFileWriteGuard: Rule = {
  id: 'security/memory-file-write-guard',
  name: 'Memory File Write Guard',
  description: 'Blocks writes to agent memory/rules files without explicit human approval.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/memory-file-write-guard';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!filePath) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const protectedPaths = (ruleConfig?.options?.paths as string[]) ?? DEFAULT_PROTECTED_PATHS;
    const allowEnv = (ruleConfig?.options?.allowEnv as string) ?? DEFAULT_ALLOW_ENV;

    if (!isProtected(filePath, protectedPaths)) return { status: 'pass', ruleId };

    if (process.env[allowEnv] === '1' || process.env[allowEnv] === 'true') {
      return { status: 'pass', ruleId };
    }

    return {
      status: 'block',
      ruleId,
      message: `Write to protected memory/rules file "${filePath}" blocked. Persistent memory changes can silently weaken guardrails.`,
      fix: `If this edit is intentional, set ${allowEnv}=1 in the current shell and retry. Consider adding a dedicated reviewer to your workflow for memory changes.`,
      metadata: { filePath, allowEnv },
    };
  },
};
