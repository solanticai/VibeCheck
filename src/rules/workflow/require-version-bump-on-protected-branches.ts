import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import {
  isGitCommitCommand,
  isInMergeCommit,
  getStagedFiles,
} from './helpers/git-commit-intent.js';

const configSchema = z.object({
  branches: z.array(z.string()).optional(),
  packageFile: z.string().optional(),
});

const DEFAULT_BRANCHES = ['main', 'master'];
const DEFAULT_PACKAGE_FILE = 'package.json';

/**
 * workflow/require-version-bump-on-protected-branches
 *
 * Ported from the VGuard project's own .husky/pre-commit: blocks
 * `git commit` on release branches unless the package manifest file
 * (package.json by default) is staged, indicating a version bump.
 * Automatically bypassed for merge commits.
 */
export const requireVersionBumpOnProtectedBranches: Rule = {
  id: 'workflow/require-version-bump-on-protected-branches',
  name: 'Require Version Bump on Protected Branches',
  description:
    'Blocks commits to release branches unless package.json (or configured manifest) is staged.',
  severity: 'block',
  events: ['PreToolUse', 'git:pre-commit'],
  match: { tools: ['Bash', 'git'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/require-version-bump-on-protected-branches';

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
      const packageFile = (ruleConfig?.options?.packageFile as string) ?? DEFAULT_PACKAGE_FILE;

      const isProtected = branches.some((b) => b.toLowerCase() === branch.toLowerCase());
      if (!isProtected) return { status: 'pass', ruleId };

      if (isInMergeCommit(repoRoot)) return { status: 'pass', ruleId };

      const staged = getStagedFiles(repoRoot);
      const hasManifest = staged.some((f) => f.toLowerCase() === packageFile.toLowerCase());

      if (hasManifest) return { status: 'pass', ruleId };

      return {
        status: 'block',
        ruleId,
        message: `${packageFile} must be updated (version bump) when committing to "${branch}".`,
        fix: `Bump the version in ${packageFile} and stage it: git add ${packageFile}`,
        metadata: { branch, packageFile },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
