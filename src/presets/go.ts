import type { Preset } from '../types.js';

/**
 * Go preset.
 *
 * Enforces Go conventions:
 * - Go naming conventions (exported = capitalized)
 * - Max file length
 * - Format on save (gofmt)
 */
export const go: Preset = {
  id: 'go',
  name: 'Go',
  description: 'Go conventions: naming, file length limits, gofmt formatting.',
  version: '1.0.0',
  rules: {
    'quality/naming-conventions': true,
    'quality/max-file-length': {
      maxLines: 500,
    },
    'workflow/format-on-save': true,
    'security/secret-detection': true,
  },
};
