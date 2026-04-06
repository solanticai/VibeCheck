import type { Rule, RuleResult } from '../../types.js';
import { isTestFile } from '../../utils/code-analysis.js';

/** Mock patterns that need cleanup */
const MOCK_PATTERNS = [
  /\bvi\.mock\s*\(/,
  /\bjest\.mock\s*\(/,
  /\bvi\.spyOn\s*\(/,
  /\bjest\.spyOn\s*\(/,
];

/** Cleanup patterns that restore mocks */
const CLEANUP_PATTERNS = [
  /vi\.restoreAllMocks\s*\(\)/,
  /jest\.restoreAllMocks\s*\(\)/,
  /vi\.resetAllMocks\s*\(\)/,
  /jest\.resetAllMocks\s*\(\)/,
  /vi\.clearAllMocks\s*\(\)/,
  /jest\.clearAllMocks\s*\(\)/,
];

/**
 * testing/mock-cleanup
 *
 * Warns when test files use mocking APIs (vi.mock, jest.mock, vi.spyOn)
 * without proper cleanup in afterEach blocks. Leaked mocks cause flaky
 * tests and cross-contamination between test cases.
 */
export const mockCleanup: Rule = {
  id: 'testing/mock-cleanup',
  name: 'Mock Cleanup',
  description: 'Warns when mocks are not cleaned up with afterEach in test files.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'testing/mock-cleanup';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check test files
    if (!isTestFile(filePath)) return { status: 'pass', ruleId };

    // Check if mocks are used
    const hasMocks = MOCK_PATTERNS.some((pattern) => pattern.test(content));
    if (!hasMocks) return { status: 'pass', ruleId };

    // Check if cleanup exists
    const hasCleanup = CLEANUP_PATTERNS.some((pattern) => pattern.test(content));
    if (hasCleanup) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: 'Mocks are used without cleanup. Missing afterEach with restoreAllMocks/resetAllMocks.',
      fix: 'Add `afterEach(() => { vi.restoreAllMocks(); });` to clean up mocks between tests.',
    };
  },
};
