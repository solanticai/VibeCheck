import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  requireForTypes: z.boolean().optional(),
  minUndocumented: z.number().int().positive().optional(),
});

/**
 * documentation/public-api-jsdoc
 *
 * Warns when exported functions, classes, and (optionally) types lack
 * JSDoc comments. AI-generated code rarely includes documentation, which
 * makes maintaining and extending the codebase harder.
 */
export const publicApiJsdoc: Rule = {
  id: 'documentation/public-api-jsdoc',
  name: 'Public API JSDoc',
  description: 'Warns when exported functions and classes lack JSDoc comments.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'documentation/public-api-jsdoc';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Skip index/barrel files
    const filename = normalizePath(filePath).split('/').pop()?.toLowerCase() ?? '';
    if (filename.startsWith('index.')) return { status: 'pass', ruleId };

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts') || filePath.endsWith('.d.mts')) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const requireForTypes = (ruleConfig?.options?.requireForTypes as boolean) ?? false;
    const minUndocumented = (ruleConfig?.options?.minUndocumented as number) ?? 2;

    const lines = content.split('\n');
    const undocumented: string[] = [];

    // Patterns for exported symbols
    const exportPattern = requireForTypes
      ? /^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/
      : /^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = exportPattern.exec(line);
      if (!match) continue;

      const name = match[1];

      // Check if the preceding non-empty line is a JSDoc closing tag
      let hasJsdoc = false;
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (!prevLine) continue; // Skip empty lines
        if (prevLine.endsWith('*/')) {
          hasJsdoc = true;
        }
        break; // Only check the first non-empty preceding line
      }

      if (!hasJsdoc) {
        undocumented.push(name);
      }
    }

    if (undocumented.length >= minUndocumented) {
      const names = undocumented.slice(0, 5).join(', ');
      const suffix = undocumented.length > 5 ? ` (and ${undocumented.length - 5} more)` : '';
      return {
        status: 'warn',
        ruleId,
        message: `${undocumented.length} exported symbols lack JSDoc: ${names}${suffix}.`,
        fix: 'Add /** ... */ JSDoc comments above exported functions and classes.',
        metadata: { undocumented, count: undocumented.length },
      };
    }

    return { status: 'pass', ruleId };
  },
};
