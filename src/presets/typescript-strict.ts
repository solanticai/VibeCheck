import type { Preset } from '../types.js';

/**
 * TypeScript Strict preset.
 *
 * Enforces:
 * - Import aliases instead of deep relative imports
 */
export const typescriptStrict: Preset = {
  id: 'typescript-strict',
  name: 'TypeScript Strict',
  description: 'Strict TypeScript patterns: import aliases, no deep relative imports.',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': {
      aliases: ['@/', '~/'],
    },
    'quality/no-console-log': true,
    'quality/max-file-length': true,
    'quality/no-any-type': true,
    'quality/error-handling': true,
    'security/unsafe-eval': true,
    'maintainability/cyclomatic-complexity': true,
    'maintainability/max-function-params': true,
    'maintainability/consistent-returns': true,
    'documentation/public-api-jsdoc': true,
  },
};
