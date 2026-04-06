import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  maxParams: z.number().int().positive().optional(),
});

/** Patterns that define a function with params */
const FUNCTION_PATTERNS = [
  // function name(params)
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
  // const name = (params) => or const name = async (params) =>
  /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]*?)?\s*=>/,
  // const name = function(params)
  /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
];

/**
 * maintainability/max-function-params
 *
 * Warns when functions have too many parameters. Functions with many
 * parameters are hard to call correctly, test, and maintain. AI agents
 * frequently generate long parameter lists instead of using options objects.
 */
export const maxFunctionParams: Rule = {
  id: 'maintainability/max-function-params',
  name: 'Max Function Params',
  description: 'Warns when functions have more than a configurable number of parameters (default: 4).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'maintainability/max-function-params';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts') || filePath.endsWith('.d.mts')) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const maxParams = (ruleConfig?.options?.maxParams as number) ?? 4;

    const violations: { name: string; count: number }[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      for (const pattern of FUNCTION_PATTERNS) {
        const match = pattern.exec(line);
        if (!match) continue;

        const name = match[1];
        const params = match[2].trim();
        if (!params) break; // 0 params is fine

        const count = countParams(params);
        if (count > maxParams) {
          violations.push({ name, count });
        }
        break; // Only match first pattern per line
      }
    }

    if (violations.length > 0) {
      const worst = violations.reduce((a, b) => (a.count > b.count ? a : b));
      return {
        status: 'warn',
        ruleId,
        message: `Function "${worst.name}" has ${worst.count} parameters (max: ${maxParams}).${violations.length > 1 ? ` ${violations.length} functions exceed the limit.` : ''}`,
        fix: 'Use an options object pattern: function create(options: CreateOptions)',
        metadata: { functions: violations, maxParams },
      };
    }

    return { status: 'pass', ruleId };
  },
};

/** Count parameters, treating destructured params ({ a, b }) as 1 */
function countParams(params: string): number {
  const trimmed = params.trim();
  if (!trimmed) return 0;

  let count = 0;
  let depth = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{' || ch === '[' || ch === '<') depth++;
    else if (ch === '}' || ch === ']' || ch === '>') depth--;
    else if (ch === ',' && depth === 0) count++;
  }

  return count + 1;
}
