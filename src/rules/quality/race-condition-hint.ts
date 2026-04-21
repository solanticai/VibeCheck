import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const READ_THEN_WRITE_PATTERN =
  /\bawait\s+\w+\.(?:findOne|findUnique|findFirst|get|select)[\s\S]{0,300}?\bawait\s+\w+\.(?:update|save|set|upsert|put)\b/;

const TRANSACTION_MARKERS = [
  /\btx\./,
  /\b\$transaction\s*\(/,
  /\bwithTransaction\s*\(/,
  /\bFOR\s+UPDATE\b/i,
  /\bsession\.withTransaction\s*\(/,
  /\bknex\.transaction\s*\(/,
];

/**
 * quality/race-condition-hint
 *
 * Hints at the classic TOCTOU read-then-write pattern (findOne -> update)
 * without any transaction/lock keyword. Severity `info` — the pattern has
 * false positives, but surfacing it improves AI-generated code quality.
 */
export const raceConditionHint: Rule = {
  id: 'quality/race-condition-hint',
  name: 'Race Condition Hint',
  description: 'Hints when a read-then-write pair appears outside a transaction.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'quality/race-condition-hint';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (!READ_THEN_WRITE_PATTERN.test(content)) return { status: 'pass', ruleId };
    if (TRANSACTION_MARKERS.some((p) => p.test(content))) return { status: 'pass', ruleId };

    return {
      status: 'warn', // info severity is resolved at adapter; 'warn' status is the rule's self-declared outcome
      ruleId,
      message:
        'Read-then-write pattern without a transaction — possible race condition if the row changes between read and update.',
      fix: 'Wrap in a transaction (db.$transaction([...]) / withTransaction / session.withTransaction), or use an atomic update with a where clause that includes the previous state.',
    };
  },
};
