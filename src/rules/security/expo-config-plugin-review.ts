import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

export const expoConfigPluginReview: Rule = {
  id: 'security/expo-config-plugin-review',
  name: 'Expo Config Plugin Review',
  description:
    'Warns when app.json/app.config adds a non-scoped config plugin (supply-chain risk).',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/expo-config-plugin-review';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\/app\.(?:json|config\.(?:ts|js))$/.test(p)) return { status: 'pass', ruleId };
    const match = content.match(/"plugins"\s*:\s*\[([^\]]+)\]/);
    if (!match) return { status: 'pass', ruleId };
    const block = match[1] ?? '';
    const names = block.match(/"([^"]+)"/g) ?? [];
    const unscoped = names
      .map((n) => n.replace(/"/g, ''))
      .filter((n) => !n.startsWith('expo-') && !n.startsWith('@expo/') && !n.startsWith('./'));
    if (unscoped.length === 0) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: `Non-Expo config plugin(s): ${unscoped.join(', ')}. Review before trusting.`,
      fix: 'Prefer first-party (`expo-*` / `@expo/*`) plugins. Audit source for any community plugin you add.',
    };
  },
};
