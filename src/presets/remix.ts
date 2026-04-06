import type { Preset } from '../types.js';

/**
 * Remix preset.
 *
 * Enforces:
 * - Import aliases (~/) for Remix convention
 * - Component naming conventions
 * - File structure for routes and components
 * - No console.log in production code
 * - Proper error handling (ErrorBoundary patterns)
 * - Accessibility in JSX
 */
export const remix: Preset = {
  id: 'remix',
  name: 'Remix',
  description: 'Remix conventions: route structure, ~/aliases, error boundaries.',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': {
      aliases: ['~/'],
    },
    'quality/naming-conventions': true,
    'quality/file-structure': true,
    'quality/no-console-log': true,
    'quality/error-handling': true,
    'quality/a11y-jsx': true,
    'performance/bundle-size': true,
    'performance/image-optimization': true,
  },
};
