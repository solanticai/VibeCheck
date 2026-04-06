import type { Preset } from '../types.js';

/**
 * Next.js 15 App Router preset.
 *
 * Enforces:
 * - No "use client" in page.tsx and layout.tsx (Server Components)
 * - Import aliases (@/) instead of deep relative or src/ imports
 */
export const nextjs15: Preset = {
  id: 'nextjs-15',
  name: 'Next.js 15',
  description:
    'Next.js 15 App Router conventions: Server Components, path aliases, file structure.',
  version: '1.0.0',
  rules: {
    'quality/no-use-client-in-pages': true,
    'quality/import-aliases': {
      aliases: ['@/'],
    },
    'quality/file-structure': true,
    'quality/no-console-log': true,
    'security/env-exposure': true,
    'security/unsafe-eval': true,
    'security/no-hardcoded-urls': true,
    'quality/error-handling': true,
    'quality/a11y-jsx': true,
    'performance/bundle-size': true,
    'performance/image-optimization': { framework: 'nextjs' },
    'maintainability/no-god-files': true,
  },
};
