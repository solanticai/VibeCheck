import type { Rule, RuleResult } from '../../types.js';
import { gitCommand } from '../../utils/git.js';

const DEFAULT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

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
  events: ['Stop', 'git:commit-msg'],
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/commit-conventions';

    // In the native git commit-msg hook the message is passed through
    // toolInput.commitMessage — block severity because we can actually
    // abort the commit here (Stop mode is advisory-only).
    const isGitHook = context.event === 'git:commit-msg';
    const commitMessage = isGitHook
      ? ((context.toolInput?.commitMessage as string | undefined) ?? '').split('\n')[0]
      : (() => {
          const cwd = context.gitContext.repoRoot ?? process.cwd();
          return gitCommand(['log', '-1', '--format=%s'], cwd);
        })();

    if (!commitMessage) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const types = (ruleConfig?.options?.types as string[]) ?? DEFAULT_TYPES;
    const typePattern = types.join('|');
    const regex = new RegExp(`^(${typePattern})(\\(.+\\))?!?:\\s.+`);

    if (!regex.test(commitMessage)) {
      return {
        status: isGitHook ? 'block' : 'warn',
        ruleId,
        message: `Commit message "${commitMessage}" doesn't follow conventional commit format.`,
        fix: `Use format: type(scope): description (e.g., "feat(auth): add login flow").\nValid types: ${types.join(', ')}`,
      };
    }

    return { status: 'pass', ruleId };
  },
};
