import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  maxDepth: z.number().int().positive().optional(),
});

/**
 * maintainability/no-deep-nesting
 *
 * Warns when code has deeply nested blocks (if/for/while/try). Deeply
 * nested code is hard to read and reason about. AI agents frequently
 * generate nested conditionals instead of using early returns or
 * extracting helper functions.
 */
export const noDeepNesting: Rule = {
  id: 'maintainability/no-deep-nesting',
  name: 'No Deep Nesting',
  description: 'Warns when code nesting exceeds a configurable depth (default: 4).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'maintainability/no-deep-nesting';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'py', 'go', 'rs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const maxDepth = (ruleConfig?.options?.maxDepth as number) ?? 4;

    let depth = 0;
    let maxFound = 0;
    let deepestLine = 0;
    let inString = false;
    let stringChar = '';

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip full-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) continue;

      for (let j = 0; j < line.length; j++) {
        const ch = line[j];

        // Track string state to avoid counting braces inside strings
        if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
          inString = true;
          stringChar = ch;
          continue;
        }
        if (inString && ch === stringChar && line[j - 1] !== '\\') {
          inString = false;
          continue;
        }
        if (inString) continue;

        if (ch === '{') {
          depth++;
          if (depth > maxFound) {
            maxFound = depth;
            deepestLine = i + 1;
          }
        } else if (ch === '}') {
          depth = Math.max(0, depth - 1);
        }
      }
    }

    if (maxFound > maxDepth) {
      return {
        status: 'warn',
        ruleId,
        message: `Nesting depth of ${maxFound} exceeds limit of ${maxDepth} (deepest at line ${deepestLine}).`,
        fix: 'Extract deeply nested logic into separate functions or use early returns to reduce nesting.',
        metadata: { maxFound, maxDepth, deepestLine },
      };
    }

    return { status: 'pass', ruleId };
  },
};
