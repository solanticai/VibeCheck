import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { isTestFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  maxSnapshots: z.number().int().positive().optional(),
});

/**
 * testing/no-snapshot-abuse
 *
 * Warns when test files overuse snapshot assertions. AI agents tend to
 * rely on snapshots as a lazy testing strategy — large snapshots are
 * unmaintainable and rarely catch real bugs.
 */
export const noSnapshotAbuse: Rule = {
  id: 'testing/no-snapshot-abuse',
  name: 'No Snapshot Abuse',
  description: 'Warns when test files contain too many snapshot assertions.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'testing/no-snapshot-abuse';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    // Only check test files
    if (!isTestFile(filePath)) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const maxSnapshots = (ruleConfig?.options?.maxSnapshots as number) ?? 3;

    let count = 0;

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      if (/\.toMatchSnapshot\s*\(/.test(trimmed)) count++;
      if (/\.toMatchInlineSnapshot\s*\(/.test(trimmed)) count++;
    }

    if (count > maxSnapshots) {
      return {
        status: 'warn',
        ruleId,
        message: `${count} snapshot assertions found (limit: ${maxSnapshots}). Snapshot-heavy tests are fragile and hard to maintain.`,
        fix: 'Replace snapshot assertions with specific expectations that verify actual behavior.',
        metadata: { count, maxSnapshots },
      };
    }

    return { status: 'pass', ruleId };
  },
};
