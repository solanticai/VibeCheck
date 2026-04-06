import type { Rule, RuleResult } from '../../types.js';
import { isTestFile } from '../../utils/code-analysis.js';

/**
 * testing/no-test-skip
 *
 * Warns when test files contain .skip(), .only(), xit(), xdescribe(), or
 * other focus/skip patterns. These are meant for local debugging and should
 * not be committed — they silently disable tests or prevent CI from running
 * the full suite.
 */
export const noTestSkip: Rule = {
  id: 'testing/no-test-skip',
  name: 'No Test Skip',
  description: 'Warns on .skip(), .only(), xit(), xdescribe() in test files.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'testing/no-test-skip';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check test files
    if (!isTestFile(filePath)) return { status: 'pass', ruleId };

    const violations: string[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // .skip() and .only() patterns
      if (/\.(skip|only)\s*\(/.test(trimmed)) {
        const pattern = trimmed.includes('.skip') ? '.skip()' : '.only()';
        if (!violations.includes(pattern)) violations.push(pattern);
      }

      // Jasmine/Jest skip patterns: xit, xdescribe, xtest
      if (/\bxit\s*\(/.test(trimmed) && !violations.includes('xit()')) {
        violations.push('xit()');
      }
      if (/\bxdescribe\s*\(/.test(trimmed) && !violations.includes('xdescribe()')) {
        violations.push('xdescribe()');
      }
      if (/\bxtest\s*\(/.test(trimmed) && !violations.includes('xtest()')) {
        violations.push('xtest()');
      }

      // Jasmine/Jest focus patterns: fit, fdescribe
      if (/\bfit\s*\(/.test(trimmed) && !violations.includes('fit()')) {
        violations.push('fit()');
      }
      if (/\bfdescribe\s*\(/.test(trimmed) && !violations.includes('fdescribe()')) {
        violations.push('fdescribe()');
      }
    }

    if (violations.length > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `Test skip/focus patterns detected: ${violations.join(', ')}. These prevent full test suite execution in CI.`,
        fix: 'Remove .skip()/.only() and other focus patterns before committing.',
        metadata: { patterns: violations },
      };
    }

    return { status: 'pass', ruleId };
  },
};
