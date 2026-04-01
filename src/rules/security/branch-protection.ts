import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { DEFAULT_PROTECTED_BRANCHES } from '../../config/defaults.js';

const configSchema = z.object({
  protectedBranches: z.array(z.string()).optional(),
});

/**
 * security/branch-protection
 *
 * Blocks Edit/Write operations when the target file is in a git repository
 * on a protected branch (main, master by default).
 *
 * Ported from Lumioh's enforce-branch.py — reimagined to auto-discover
 * the repo root instead of using hardcoded paths.
 */
export const branchProtection: Rule = {
  id: 'security/branch-protection',
  name: 'Branch Protection',
  description: 'Blocks writes to files on protected branches. Create a feature branch first.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Edit', 'Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'security/branch-protection';

    // Get the current branch from git context
    const { branch, repoRoot } = context.gitContext;

    // Not in a git repo — pass
    if (!repoRoot || !branch) {
      return { status: 'pass', ruleId };
    }

    // Get protected branches from config
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const protectedBranches: string[] =
      (ruleConfig?.options?.protectedBranches as string[]) ?? DEFAULT_PROTECTED_BRANCHES;

    // Check if current branch is protected
    const isProtected = protectedBranches.some((pb) => branch.toLowerCase() === pb.toLowerCase());

    if (isProtected) {
      return {
        status: 'block',
        ruleId,
        message: `Cannot write to files on branch '${branch}'. Protected branches: ${protectedBranches.join(', ')}.`,
        fix: `Create a feature branch first: git checkout -b feat/your-change`,
      };
    }

    return { status: 'pass', ruleId };
  },
};
