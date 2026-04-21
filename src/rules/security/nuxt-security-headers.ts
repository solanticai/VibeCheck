import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const nuxtSecurityHeaders: Rule = {
  id: 'security/nuxt-security-headers',
  name: 'Nuxt Security Headers',
  description: 'Warns when nuxt.config.ts does not use nuxt-security or set headers explicitly.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nuxt-security-headers';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\bnuxt\.config\.(?:ts|js)$/.test(p)) return { status: 'pass', ruleId };
    if (/nuxt-security/.test(content) || /securityHeaders\s*:/.test(content)) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message: 'nuxt.config does not configure security headers.',
      fix: 'Install and register nuxt-security: `npm i -D nuxt-security` then add to modules. Alternatively set headers in routeRules manually.',
    };
  },
};
