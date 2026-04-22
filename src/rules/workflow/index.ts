import type { Rule } from '../../types.js';
import { commitConventions } from './commit-conventions.js';
import { prReminder } from './pr-reminder.js';
import { migrationSafety } from './migration-safety.js';
import { reviewGate } from './review-gate.js';
import { todoTracker } from './todo-tracker.js';
import { changelogReminder } from './changelog-reminder.js';
import { formatOnSave } from './format-on-save.js';
import { branchNaming } from './branch-naming.js';
import { lockfileConsistency } from './lockfile-consistency.js';
import { lockfileVersionMatch } from './lockfile-version-match.js';
import { requireChangelogOnProtectedBranches } from './require-changelog-on-protected-branches.js';
import { requireVersionBumpOnProtectedBranches } from './require-version-bump-on-protected-branches.js';
import { costBudget } from './cost-budget.js';
import { autonomyCircuitBreaker } from './autonomy-circuit-breaker.js';
import { highImpactConfirm } from './high-impact-confirm.js';

export const workflowRules: Rule[] = [
  commitConventions,
  prReminder,
  migrationSafety,
  reviewGate,
  todoTracker,
  changelogReminder,
  formatOnSave,
  branchNaming,
  lockfileConsistency,
  lockfileVersionMatch,
  requireChangelogOnProtectedBranches,
  requireVersionBumpOnProtectedBranches,
  costBudget,
  autonomyCircuitBreaker,
  highImpactConfirm,
];

export {
  commitConventions,
  prReminder,
  migrationSafety,
  reviewGate,
  todoTracker,
  changelogReminder,
  formatOnSave,
  branchNaming,
  lockfileConsistency,
  lockfileVersionMatch,
  requireChangelogOnProtectedBranches,
  requireVersionBumpOnProtectedBranches,
  costBudget,
  autonomyCircuitBreaker,
  highImpactConfirm,
};
