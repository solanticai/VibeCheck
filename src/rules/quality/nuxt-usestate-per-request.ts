import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const nuxtUseStatePerRequest: Rule = {
  id: 'quality/nuxt-usestate-per-request',
  name: 'Nuxt useState Per Request',
  description:
    'Warns when module-level const is used where useState would scope per request in Nuxt.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'quality/nuxt-usestate-per-request';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js', 'vue'].includes(ext)) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\/(?:composables|server\/utils|utils)\//.test(p)) return { status: 'pass', ruleId };

    // Module-level `const userCache = ...` that looks like shared state
    if (
      /^\s*(?:const|let)\s+\w*(?:Cache|State|Store)\s*=\s*(?:new\s+)?(?:Map|Set|\{|\[)/m.test(
        content,
      )
    ) {
      return {
        status: 'warn',
        ruleId,
        message:
          'Module-level mutable cache/state in a Nuxt composable/util — shared across SSR requests.',
        fix: 'Use useState(key, () => initial) so each SSR request gets its own copy.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
