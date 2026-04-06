import type { Preset } from '../types.js';

/**
 * Supabase preset.
 *
 * Enforces:
 * - Migration safety (dangerous SQL warnings)
 * - Import aliases (no deep relative imports)
 */
export const supabase: Preset = {
  id: 'supabase',
  name: 'Supabase',
  description: 'Supabase best practices: migration safety, async client patterns.',
  version: '1.0.0',
  rules: {
    'workflow/migration-safety': true,
    'quality/import-aliases': {
      aliases: ['@/'],
    },
    'security/env-exposure': true,
    'quality/no-console-log': true,
    'security/sql-injection': true,
    'reliability/no-unhandled-promises': true,
  },
};
