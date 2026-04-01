import type { Rule } from '../../types.js';
import { commitConventions } from './commit-conventions.js';
import { prReminder } from './pr-reminder.js';
import { migrationSafety } from './migration-safety.js';

export const workflowRules: Rule[] = [commitConventions, prReminder, migrationSafety];

export { commitConventions, prReminder, migrationSafety };
