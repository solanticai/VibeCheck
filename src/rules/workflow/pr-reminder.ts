import type { Rule, RuleResult } from '../../types.js';

/**
 * workflow/pr-reminder
 *
 * At session end (Stop event), checks for uncommitted or unpushed work
 * and reminds the developer to create a PR.
 *
 * Reimagined from Lumioh's pr-reminder.py — auto-detects repo
 * instead of using hardcoded paths.
 */
export const prReminder: Rule = {
  id: 'workflow/pr-reminder',
  name: 'PR Reminder',
  description: 'Reminds about uncommitted/unpushed work at session end.',
  severity: 'info',
  events: ['Stop'],
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/pr-reminder';
    const { branch, isDirty, unpushedCount, hasRemote, repoRoot } = context.gitContext;

    if (!repoRoot || !branch) {
      return { status: 'pass', ruleId };
    }

    const issues: string[] = [];

    // Check for uncommitted changes
    if (isDirty) {
      issues.push('Uncommitted changes detected');
    }

    // Check for unpushed commits
    if (unpushedCount > 0) {
      issues.push(`${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''}`);
    }

    // Check if branch has no remote tracking
    if (!hasRemote && branch !== 'main' && branch !== 'master') {
      issues.push(`Branch "${branch}" has no remote tracking`);
    }

    if (issues.length === 0) {
      return { status: 'pass', ruleId };
    }

    const isOnProtectedBranch = ['main', 'master', 'dev'].includes(branch.toLowerCase());
    let fix: string;

    if (isOnProtectedBranch && isDirty) {
      fix = `Create a feature branch first: git checkout -b feat/your-change`;
    } else if (!hasRemote) {
      fix = `Push and create a PR: git push -u origin ${branch}`;
    } else if (unpushedCount > 0) {
      fix = `Push your changes: git push`;
    } else {
      fix = `Commit your changes: git add -A && git commit`;
    }

    return {
      status: 'warn',
      ruleId,
      message: `Pending work on branch "${branch}": ${issues.join(', ')}.`,
      fix,
    };
  },
};
