import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import {
  isGitCommitCommand,
  isInMergeCommit,
  getStagedFiles,
} from './helpers/git-commit-intent.js';

const configSchema = z.object({
  branches: z.array(z.string()).optional(),
  path: z.string().optional(),
});

const DEFAULT_BRANCHES = ['main', 'master', 'dev'];
const DEFAULT_PATH = 'CHANGELOG.md';

/**
 * workflow/require-changelog-on-protected-branches
 *
 * Ported from the VGuard project's own .husky/pre-commit: blocks
 * `git commit` on protected branches unless CHANGELOG.md (or a configured
 * path) is staged. Automatically bypassed for merge commits.
 */
export const requireChangelogOnProtectedBranches: Rule = {
  id: 'workflow/require-changelog-on-protected-branches',
  name: 'Require CHANGELOG Update on Protected Branches',
  description:
    'Blocks commits to protected branches unless CHANGELOG.md (or configured file) is staged.',
  severity: 'block',
  events: ['PreToolUse', 'git:pre-commit'],
  match: { tools: ['Bash', 'git'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/require-changelog-on-protected-branches';

    try {
      // In the native git pre-commit hook we're already inside a commit;
      // skip the command-intent sniff.
      if (context.event !== 'git:pre-commit') {
        const command = context.toolInput?.command as string | undefined;
        if (!isGitCommitCommand(command)) return { status: 'pass', ruleId };
      }

      const { repoRoot, branch } = context.gitContext;
      if (!repoRoot || !branch) return { status: 'pass', ruleId };

      const ruleConfig = context.projectConfig.rules.get(ruleId);
      const branches = (ruleConfig?.options?.branches as string[]) ?? DEFAULT_BRANCHES;
      const changelogPath = (ruleConfig?.options?.path as string) ?? DEFAULT_PATH;

      const isProtected = branches.some((b) => b.toLowerCase() === branch.toLowerCase());
      if (!isProtected) return { status: 'pass', ruleId };

      if (isInMergeCommit(repoRoot)) return { status: 'pass', ruleId };

      const staged = getStagedFiles(repoRoot);
      const hasChangelog = staged.some((f) => f.toLowerCase() === changelogPath.toLowerCase());

      if (hasChangelog) return { status: 'pass', ruleId };

      return {
        status: 'block',
        ruleId,
        message: `${changelogPath} must be updated when committing to "${branch}".`,
        fix: `Add your changes to ${changelogPath} under the [Unreleased] section, then stage it: git add ${changelogPath}`,
        metadata: { branch, changelogPath },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
