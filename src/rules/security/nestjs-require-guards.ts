import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

function isNestJsController(content: string, filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  if (!/\.(controller)\.(?:ts|js)$/i.test(p)) return false;
  return /@Controller\s*\(/.test(content);
}

export const nestjsRequireGuards: Rule = {
  id: 'security/nestjs-require-guards',
  name: 'NestJS Require Guards',
  description: 'Warns when a NestJS controller has no @UseGuards or global guard reference.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nestjs-require-guards';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    if (!isNestJsController(content, filePath)) return { status: 'pass', ruleId };
    if (/@UseGuards\s*\(/.test(content) || /@Public\s*\(/.test(content)) {
      return { status: 'pass', ruleId };
    }
    // Check if controller has any route handlers with sensitive verbs
    if (!/@(?:Get|Post|Put|Patch|Delete)\s*\(/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'NestJS controller has no @UseGuards — mark routes @Public() or apply a guard.',
      fix: 'Apply @UseGuards(AuthGuard) at the controller or method level. For intentionally public routes, use @Public() or @SkipAuth() to make the choice explicit.',
    };
  },
};
