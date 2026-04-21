import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

export const phoenixSobelowRequired: Rule = {
  id: 'security/phoenix-sobelow-required',
  name: 'Phoenix Sobelow Required',
  description: 'Warns when a Phoenix mix.exs has no :sobelow dependency.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/phoenix-sobelow-required';
    try {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!/mix\.exs$/.test(filePath)) return { status: 'pass', ruleId };
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      const mixPath = join(repoRoot, 'mix.exs');
      const existing = existsSync(mixPath) ? readFileSync(mixPath, 'utf-8') : '';
      const hasPhoenix = /:phoenix\b/.test(existing);
      if (!hasPhoenix) return { status: 'pass', ruleId };
      const newContent = (context.toolInput.content as string) ?? existing;
      if (/:sobelow\b/.test(newContent)) return { status: 'pass', ruleId };
      return {
        status: 'warn',
        ruleId,
        message: 'Phoenix mix.exs without :sobelow.',
        fix: 'Add {:sobelow, "~> 0.13", only: [:dev, :test], runtime: false} to deps.',
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
