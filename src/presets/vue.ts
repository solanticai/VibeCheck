import type { Preset } from '../types.js';

/**
 * Vue.js preset.
 *
 * Enforces:
 * - Import aliases (@/) instead of deep relative imports
 * - Component naming conventions (PascalCase)
 * - File structure (components in proper directories)
 * - No console.log in production code
 * - XSS prevention (v-html warnings)
 * - Accessibility checks in templates
 */
export const vue: Preset = {
  id: 'vue',
  name: 'Vue.js',
  description: 'Vue.js conventions: SFC structure, import aliases, XSS prevention.',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': {
      aliases: ['@/'],
    },
    'quality/naming-conventions': true,
    'quality/file-structure': true,
    'quality/no-console-log': true,
    'security/xss-prevention': true,
    'quality/a11y-jsx': true,
    'performance/bundle-size': true,
    'performance/image-optimization': true,
  },
};
