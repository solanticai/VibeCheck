import type { Preset } from '../types.js';

/**
 * Astro preset.
 *
 * Enforces Astro framework conventions:
 * - Import aliases for clean imports
 * - Naming conventions for Astro pages/layouts
 * - File structure validation
 * - No console.log in production code
 */
export const astro: Preset = {
  id: 'astro',
  name: 'Astro',
  description: 'Astro framework conventions: page/layout structure, import aliases.',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': {
      aliases: ['@/', '~/'],
    },
    'quality/naming-conventions': true,
    'quality/file-structure': true,
    'quality/no-console-log': true,
    'performance/bundle-size': true,
    'performance/image-optimization': { framework: 'astro' },
  },
};
