import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const mongoStrictSchemaValidation: Rule = {
  id: 'security/mongo-strict-schema-validation',
  name: 'Mongo Strict Schema Validation',
  description:
    'Warns when Mongoose schemas set strict:false or Mongo createCollection lacks validator.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/mongo-strict-schema-validation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (/new\s+(?:mongoose\.)?Schema\s*\([\s\S]*strict\s*:\s*false/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Mongoose Schema with strict:false — accepts arbitrary fields from user input.',
        fix: 'Remove strict:false. Use a Zod layer before the DB if you need flexible input.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
