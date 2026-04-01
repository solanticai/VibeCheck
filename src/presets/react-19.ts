import type { Preset } from '../types.js';

/**
 * React 19 preset.
 *
 * Enforces:
 * - Hook naming conventions (use prefix)
 * - Component naming (PascalCase)
 * - No deprecated React APIs (React.FC)
 * - File structure (components in /components/, hooks in /hooks/)
 */
export const react19: Preset = {
  id: 'react-19',
  name: 'React 19',
  description: 'React 19 patterns: hook naming, component conventions, no deprecated APIs.',
  version: '1.0.0',
  rules: {
    'quality/naming-conventions': {
      componentDirs: ['/components/', '/_components/'],
      hookDirs: ['/hooks/', '/_hooks/'],
    },
    'quality/no-deprecated-api': true,
    'quality/file-structure': {
      framework: 'react',
    },
  },
};
