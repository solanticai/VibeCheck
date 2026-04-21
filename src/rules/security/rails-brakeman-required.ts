import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

export const railsBrakemanRequired: Rule = {
  id: 'security/rails-brakeman-required',
  name: 'Rails Brakeman Required',
  description: 'Warns when a Rails project has no brakeman in Gemfile.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/rails-brakeman-required';
    try {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!/Gemfile$/.test(filePath)) return { status: 'pass', ruleId };
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      const gemfile = existsSync(join(repoRoot, 'Gemfile'))
        ? readFileSync(join(repoRoot, 'Gemfile'), 'utf-8')
        : '';
      if (!/gem\s+['"]rails['"]/.test(gemfile)) return { status: 'pass', ruleId };
      const newContent = (context.toolInput.content as string) ?? gemfile;
      if (/gem\s+['"]brakeman['"]/.test(newContent)) return { status: 'pass', ruleId };
      return {
        status: 'warn',
        ruleId,
        message: 'Rails Gemfile without `brakeman` — no SAST coverage.',
        fix: 'Add `gem "brakeman", require: false, group: :development`.',
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
