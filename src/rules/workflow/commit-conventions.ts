import type { Rule, RuleResult } from '../../types.js';
import { gitCommand } from '../../utils/git.js';

const DEFAULT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

/**
 * workflow/commit-conventions
 *
 * Validates that the most recent commit follows conventional commit format.
 * Runs at session Stop to check work done during the session.
 */
export const commitConventions: Rule = {
  id: 'workflow/commit-conventions',
  name: 'Commit Conventions',
  description: 'Validates conventional commit format (feat/fix/chore/etc).',
  severity: 'warn',
  events: ['Stop'],
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/commit-conventions';
    const cwd = context.gitContext.repoRoot ?? process.cwd();

    // Get the last commit message
    const lastCommit = gitCommand(['log', '-1', '--format=%s'], cwd);
    if (!lastCommit) {
      return { status: 'pass', ruleId };
    }

    // Check conventional commit format
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const types = (ruleConfig?.options?.types as string[]) ?? DEFAULT_TYPES;
    const typePattern = types.join('|');
    const regex = new RegExp(`^(${typePattern})(\\(.+\\))?!?:\\s.+`);

    if (!regex.test(lastCommit)) {
      return {
        status: 'warn',
        ruleId,
        message: `Last commit "${lastCommit}" doesn't follow conventional commit format.`,
        fix: `Use format: type(scope): description (e.g., "feat(auth): add login flow").\nValid types: ${types.join(', ')}`,
      };
    }

    return { status: 'pass', ruleId };
  },
};
