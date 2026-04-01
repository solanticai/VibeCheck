import type { Preset } from '../types.js';

/**
 * Tailwind CSS preset.
 *
 * Enforces:
 * - No CSS/SCSS files (use utility classes)
 * - No inline styles (use className)
 * - Import aliases
 */
export const tailwind: Preset = {
  id: 'tailwind',
  name: 'Tailwind CSS',
  description: 'Tailwind CSS enforcement: no CSS files, no inline styles, utility-first.',
  version: '1.0.0',
  rules: {
    'quality/anti-patterns': {
      blockCssFiles: true,
      blockInlineStyles: true,
    },
  },
};
