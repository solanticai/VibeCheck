import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { extractFunctions, isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  maxComplexity: z.number().int().positive().optional(),
});

/** Branching keywords that increase cyclomatic complexity */
const BRANCH_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bcase\s+/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
  /\?[^?:.]/g, // Ternary (avoid matching ?. and ??)
];

/**
 * maintainability/cyclomatic-complexity
 *
 * Warns when function complexity exceeds a configurable threshold.
 * AI agents frequently generate monolithic functions with many branching
 * paths that are hard to test and maintain.
 */
export const cyclomaticComplexity: Rule = {
  id: 'maintainability/cyclomatic-complexity',
  name: 'Cyclomatic Complexity',
  description: 'Warns when function complexity exceeds a configurable threshold (default: 10).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'maintainability/cyclomatic-complexity';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const maxComplexity = (ruleConfig?.options?.maxComplexity as number) ?? 10;

    const functions = extractFunctions(content);
    const violations: { name: string; complexity: number }[] = [];

    for (const fn of functions) {
      const complexity = calculateComplexity(fn.body);

      if (complexity > maxComplexity) {
        violations.push({ name: fn.name, complexity });
      }
    }

    if (violations.length > 0) {
      const worst = violations.reduce((a, b) => (a.complexity > b.complexity ? a : b));
      return {
        status: 'warn',
        ruleId,
        message: `Function "${worst.name}" has cyclomatic complexity of ${worst.complexity} (max: ${maxComplexity}).${violations.length > 1 ? ` ${violations.length} functions exceed the limit.` : ''}`,
        fix: 'Break complex functions into smaller, focused helper functions.',
        metadata: { functions: violations, maxComplexity },
      };
    }

    return { status: 'pass', ruleId };
  },
};

/** Calculate cyclomatic complexity for a function body */
function calculateComplexity(body: string): number {
  // Base complexity is 1 (the function itself has one path)
  let complexity = 1;

  // Remove strings and comments to avoid false positives
  const cleaned = body
    .replace(/\/\/[^\n]*/g, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '') // single-quoted strings
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '') // double-quoted strings
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, ''); // template literals

  for (const pattern of BRANCH_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = cleaned.match(new RegExp(pattern.source, 'g'));
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}
