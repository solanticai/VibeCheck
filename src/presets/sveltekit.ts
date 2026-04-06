import type { Preset } from '../types.js';

/**
 * SvelteKit preset.
 *
 * Enforces SvelteKit conventions:
 * - Import aliases ($lib/)
 * - Naming conventions for +page/+layout files
 * - File structure validation
 */
export const sveltekit: Preset = {
  id: 'sveltekit',
  name: 'SvelteKit',
  description: 'SvelteKit conventions: $lib aliases, +page/+layout naming, file structure.',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': {
      aliases: ['$lib/'],
    },
    'quality/naming-conventions': true,
    'quality/file-structure': true,
    'performance/bundle-size': true,
    'performance/image-optimization': true,
  },
};
