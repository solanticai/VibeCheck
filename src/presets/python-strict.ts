import type { Preset } from '../types.js';

/**
 * Python Strict preset.
 *
 * Enforces Python conventions:
 * - PEP 8 naming conventions
 * - Max file length (default 400 lines)
 * - No print() statements (mapped from no-console-log)
 * - Import alias limits (relative import depth)
 */
export const pythonStrict: Preset = {
  id: 'python-strict',
  name: 'Python Strict',
  description: 'Python best practices: PEP 8 naming, file length limits, no print() in production.',
  version: '1.0.0',
  rules: {
    'quality/naming-conventions': true,
    'quality/max-file-length': {
      maxLines: 400,
    },
    'quality/no-console-log': true,
    'security/secret-detection': true,
  },
};
