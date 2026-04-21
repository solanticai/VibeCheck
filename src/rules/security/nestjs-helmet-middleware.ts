import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const nestjsHelmetMiddleware: Rule = {
  id: 'security/nestjs-helmet-middleware',
  name: 'NestJS Helmet Middleware',
  description: 'Warns when a NestJS bootstrap file does not apply helmet().',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nestjs-helmet-middleware';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\/(?:main|bootstrap)\.(?:ts|js)$/.test(p)) return { status: 'pass', ruleId };
    if (!/NestFactory\.create\s*\(/.test(content)) return { status: 'pass', ruleId };
    if (/\bhelmet\s*\(/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'NestJS bootstrap without helmet() — security headers missing.',
      fix: 'Add `app.use(helmet())` after `NestFactory.create(...)`. Install with `npm i helmet`.',
    };
  },
};
