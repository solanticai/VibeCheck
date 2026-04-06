import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { isTestFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  minAssertions: z.number().int().positive().optional(),
});

/**
 * testing/assertion-count
 *
 * Warns when test blocks (`it()` or `test()`) contain zero assertions.
 * AI-generated tests frequently look correct but lack actual verification,
 * making them useless for catching regressions.
 */
export const assertionCount: Rule = {
  id: 'testing/assertion-count',
  name: 'Assertion Count',
  description: 'Warns when test blocks have zero assertions (no expect() calls).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'testing/assertion-count';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check test files
    if (!isTestFile(filePath)) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const minAssertions = (ruleConfig?.options?.minAssertions as number) ?? 1;

    // Find test blocks and check for assertions
    const emptyTests: string[] = [];
    const testBlockPattern = /\b(?:it|test)\s*\(\s*(['"`])([^'"`]*)\1/g;
    let match;

    while ((match = testBlockPattern.exec(content)) !== null) {
      const testName = match[2];
      const startIdx = match.index;

      // Find the body of this test block using brace counting
      const body = extractTestBody(content, startIdx);
      if (!body) continue;

      // Count assertions in the body
      const assertionPattern = /\bexpect\s*\(/g;
      const assertions = body.match(assertionPattern);
      const count = assertions?.length ?? 0;

      if (count < minAssertions) {
        emptyTests.push(testName);
      }
    }

    if (emptyTests.length > 0) {
      const names = emptyTests.slice(0, 3).map((n) => `"${n}"`).join(', ');
      const suffix = emptyTests.length > 3 ? ` (and ${emptyTests.length - 3} more)` : '';
      return {
        status: 'warn',
        ruleId,
        message: `${emptyTests.length} test${emptyTests.length > 1 ? 's' : ''} without assertions: ${names}${suffix}.`,
        fix: 'Add expect() assertions to verify actual behavior in each test.',
        metadata: { emptyTests, count: emptyTests.length },
      };
    }

    return { status: 'pass', ruleId };
  },
};

/** Extract the body of a test block starting from a match position */
function extractTestBody(content: string, startIdx: number): string | null {
  // Find the opening brace of the callback
  let braceStart = -1;
  let parenDepth = 0;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(') parenDepth++;
    if (ch === ')') parenDepth--;

    // Find the callback's opening brace (inside the first paren)
    if (ch === '{' && parenDepth > 0) {
      braceStart = i;
      break;
    }

    // Arrow function: () =>
    if (ch === '=' && content[i + 1] === '>' && parenDepth > 0) {
      // Look for the opening brace after =>
      for (let j = i + 2; j < content.length; j++) {
        if (content[j] === '{') {
          braceStart = j;
          break;
        }
        if (content[j] !== ' ' && content[j] !== '\n' && content[j] !== '\r') break;
      }
      break;
    }
  }

  if (braceStart === -1) return null;

  // Count braces to find the end
  let depth = 0;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(braceStart + 1, i);
      }
    }
  }

  return null;
}
