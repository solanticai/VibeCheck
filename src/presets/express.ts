import type { Preset } from '../types.js';

/**
 * Express.js preset.
 *
 * Enforces:
 * - Proper error handling (no empty catch blocks)
 * - No hardcoded URLs (use environment variables)
 * - No console.log in production (use a logger)
 * - Secret detection in source code
 * - SQL injection prevention
 * - No eval() or unsafe dynamic code
 */
export const express: Preset = {
  id: 'express',
  name: 'Express.js',
  description: 'Express.js conventions: error handling, security, no hardcoded URLs.',
  version: '1.0.0',
  rules: {
    'quality/error-handling': true,
    'security/no-hardcoded-urls': true,
    'quality/no-console-log': true,
    'security/secret-detection': true,
    'security/sql-injection': true,
    'security/unsafe-eval': true,
    'performance/no-sync-io': true,
    'reliability/no-unhandled-promises': true,
    'maintainability/cyclomatic-complexity': true,
  },
};
