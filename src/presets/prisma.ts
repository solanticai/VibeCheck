import type { Preset } from '../types.js';

/**
 * Prisma ORM preset.
 *
 * Enforces:
 * - Migration safety (dangerous SQL warnings)
 * - Naming conventions for models and files
 * - SQL injection prevention in raw queries
 * - Secret detection (database connection strings)
 */
export const prisma: Preset = {
  id: 'prisma',
  name: 'Prisma',
  description: 'Prisma ORM conventions: migration safety, SQL injection prevention.',
  version: '1.0.0',
  rules: {
    'workflow/migration-safety': true,
    'quality/naming-conventions': true,
    'security/sql-injection': true,
    'security/secret-detection': true,
    'reliability/no-unhandled-promises': true,
  },
};
