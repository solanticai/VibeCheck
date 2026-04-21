import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

export const expoNoExperimentalRscInProd: Rule = {
  id: 'security/expo-no-experimental-rsc-in-prod',
  name: 'Expo No Experimental RSC In Prod',
  description: 'Warns when Expo Router RSC experimental flag is enabled (Jan 2026 DoS CVE).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/expo-no-experimental-rsc-in-prod';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\bapp\.(?:json|config\.(?:ts|js|mjs|cjs))$/.test(p) && !/metro\.config\./.test(p)) {
      return { status: 'pass', ruleId };
    }
    if (
      /reactServerComponents["']?\s*:\s*true/.test(content) ||
      /unstable_enableServerComponents/.test(content)
    ) {
      return {
        status: 'warn',
        ruleId,
        message: 'Expo Router RSC flag enabled — subject to the Jan 2026 React DoS CVE.',
        fix: 'Disable until upstream patches are validated for your Expo SDK.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
