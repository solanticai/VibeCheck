import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const nestjsClassValidatorDtos: Rule = {
  id: 'security/nestjs-class-validator-dtos',
  name: 'NestJS class-validator DTOs',
  description: 'Warns when a NestJS DTO class lacks class-validator decorators.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nestjs-class-validator-dtos';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\.dto\.(?:ts|js)$/.test(p)) return { status: 'pass', ruleId };
    if (!/export\s+class\s+\w+Dto\b/.test(content)) return { status: 'pass', ruleId };
    if (/@Is(?:String|Number|Boolean|Email|Optional|UUID|Array|Date)/.test(content)) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message: 'NestJS DTO has no class-validator decorators — input is unvalidated.',
      fix: 'Decorate each field with class-validator (@IsString, @IsEmail, @IsOptional, …) and enable validation pipes globally.',
    };
  },
};
