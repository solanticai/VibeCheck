import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { extractFunctions, isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

/**
 * maintainability/consistent-returns
 *
 * Warns when a function has mixed return patterns — some paths return a
 * value while others return void or bare `return`. This usually indicates
 * a bug or inconsistent API design.
 */
export const consistentReturns: Rule = {
  id: 'maintainability/consistent-returns',
  name: 'Consistent Returns',
  description: 'Warns when functions have inconsistent return types (mixed value and void returns).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'maintainability/consistent-returns';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    const functions = extractFunctions(content);
    const violations: string[] = [];

    for (const fn of functions) {
      // Skip constructors and void-annotated functions
      if (fn.name === 'constructor') continue;

      // Skip functions with explicit void return type annotation
      // Check the line that defines the function for ': void'
      const fnDefLine = content.split('\n')[fn.startLine - 1] ?? '';
      if (/:\s*void\b/.test(fnDefLine) || /:\s*Promise<void>/.test(fnDefLine)) continue;

      const body = fn.body;

      // Remove strings, comments, and nested function bodies to avoid false matches
      const cleaned = body
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '""')
        .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
        .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '""');

      // Find return statements
      const valueReturnPattern = /\breturn\s+(?!;)[^;]+/g;
      const bareReturnPattern = /\breturn\s*;/g;

      const hasValueReturn = valueReturnPattern.test(cleaned);
      const hasBareReturn = bareReturnPattern.test(cleaned);

      if (hasValueReturn && hasBareReturn) {
        violations.push(fn.name);
      }
    }

    if (violations.length > 0) {
      const names = violations.slice(0, 3).join(', ');
      const suffix = violations.length > 3 ? ` (and ${violations.length - 3} more)` : '';
      return {
        status: 'warn',
        ruleId,
        message: `Inconsistent returns in: ${names}${suffix}. Functions mix value-returning and void-returning code paths.`,
        fix: 'Ensure all code paths return a value, or use `return undefined;` explicitly.',
        metadata: { functions: violations },
      };
    }

    return { status: 'pass', ruleId };
  },
};
