import type { Preset } from '../types.js';

/**
 * Drizzle ORM preset.
 *
 * Targets the high-risk surface of AI-assisted schema editing: dangerous
 * migrations, read-then-write races without transactions, raw SQL
 * interpolation, secrets leaking into connection strings.
 */
export const drizzle: Preset = {
  id: 'drizzle',
  name: 'Drizzle',
  description:
    'Drizzle ORM conventions: migration safety, transaction discipline, no raw SQL interpolation.',
  version: '1.0.0',
  rules: {
    'workflow/migration-safety': true,
    'quality/race-condition-hint': true,
    'security/sql-injection': true,
    'security/secret-detection': true,
    'security/no-hardcoded-urls': true,
    'workflow/require-changelog-on-protected-branches': true,
    'quality/no-any-type': true,
  },
};
