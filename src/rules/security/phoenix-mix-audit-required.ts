import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

export const phoenixMixAuditRequired: Rule = {
  id: 'security/phoenix-mix-audit-required',
  name: 'Phoenix mix_audit Required',
  description: 'Warns when a Phoenix/Elixir mix.exs has no :mix_audit dependency.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/phoenix-mix-audit-required';
    try {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!/mix\.exs$/.test(filePath)) return { status: 'pass', ruleId };
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      const mixPath = join(repoRoot, 'mix.exs');
      const existing = existsSync(mixPath) ? readFileSync(mixPath, 'utf-8') : '';
      const newContent = (context.toolInput.content as string) ?? existing;
      if (/:mix_audit\b/.test(newContent)) return { status: 'pass', ruleId };
      return {
        status: 'warn',
        ruleId,
        message: 'Elixir mix.exs without :mix_audit — no advisory coverage.',
        fix: 'Add {:mix_audit, "~> 2.0", only: [:dev, :test], runtime: false}.',
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
