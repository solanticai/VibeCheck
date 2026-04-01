import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { DANGEROUS_SQL_PATTERNS } from '../../utils/patterns.js';

/**
 * workflow/migration-safety
 *
 * Warns about dangerous SQL patterns in migration files:
 * DROP TABLE without IF EXISTS, DELETE without WHERE, etc.
 *
 * Ported directly from Lumioh's validate-migration.py.
 * Warning-only (never blocks) — helps catch mistakes before they reach production.
 */
export const migrationSafety: Rule = {
  id: 'workflow/migration-safety',
  name: 'Migration Safety',
  description: 'Warns about dangerous SQL patterns in migration files.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/migration-safety';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check SQL files
    const ext = getExtension(filePath);
    if (ext !== 'sql') return { status: 'pass', ruleId };

    const warnings: string[] = [];

    for (const [name, pattern, description] of DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`${name}: ${description}`);
      }
    }

    // Check for hardcoded UUIDs
    const uuidPattern = /['"]\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b['"]/gi;
    if (uuidPattern.test(content)) {
      warnings.push('Hardcoded UUID detected — consider using variables or parameters');
    }

    // Check for missing migration header comment
    if (!content.trim().startsWith('--')) {
      warnings.push('Missing migration header comment — add a description of what this migration does');
    }

    if (warnings.length > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `Migration safety warnings:\n${warnings.map((w) => `  - ${w}`).join('\n')}`,
        fix: 'Review each warning and add safety guards (IF EXISTS, WHERE clauses) as needed.',
      };
    }

    return { status: 'pass', ruleId };
  },
};
