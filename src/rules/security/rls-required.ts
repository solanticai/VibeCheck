import type { Rule, RuleResult } from '../../types.js';

/**
 * security/rls-required
 *
 * Scans Supabase SQL migrations for CREATE TABLE statements without
 * corresponding RLS policy enablement. Prevents data exposure from
 * missing row-level security.
 */
export const rlsRequired: Rule = {
  id: 'security/rls-required',
  name: 'RLS Required',
  description: 'Warns when SQL migrations create tables without enabling Row Level Security.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/rls-required';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check SQL files, particularly migration files
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    if (!normalized.endsWith('.sql')) return { status: 'pass', ruleId };

    // Find CREATE TABLE statements
    const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"[^"]+"|[\w.]+)\.)?(?:"([^"]+)"|(\w+))/gi;
    const tables: string[] = [];
    let match;

    while ((match = createTablePattern.exec(content)) !== null) {
      const tableName = match[1] ?? match[2];
      if (tableName) tables.push(tableName);
    }

    if (tables.length === 0) return { status: 'pass', ruleId };

    // Check if RLS is enabled for each table
    const rlsPattern = /ALTER\s+TABLE\s+(?:(?:"[^"]+"|[\w.]+)\.)?(?:"([^"]+)"|(\w+))\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    const rlsEnabledTables = new Set<string>();

    while ((match = rlsPattern.exec(content)) !== null) {
      const tableName = match[1] ?? match[2];
      if (tableName) rlsEnabledTables.add(tableName.toLowerCase());
    }

    const missingRls = tables.filter((t) => !rlsEnabledTables.has(t.toLowerCase()));

    if (missingRls.length > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `Table${missingRls.length > 1 ? 's' : ''} missing RLS: ${missingRls.join(', ')}. Row Level Security should be enabled on all tables.`,
        fix: missingRls
          .map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`)
          .join('\n'),
        metadata: { tables, missingRls },
      };
    }

    return { status: 'pass', ruleId };
  },
};
