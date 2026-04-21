import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const phoenixRawSqlFragmentScan: Rule = {
  id: 'security/phoenix-raw-sql-fragment-scan',
  name: 'Phoenix Raw SQL Fragment Scan',
  description: 'Blocks Ecto fragment(...) calls that interpolate variables into the SQL string.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/phoenix-raw-sql-fragment-scan';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (ext !== 'ex' && ext !== 'exs') return { status: 'pass', ruleId };
    // fragment("... #{var} ...")
    if (/fragment\s*\(\s*"[^"]*#\{/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'Ecto fragment() with Elixir string interpolation — bypasses parameterisation.',
        fix: 'Use the "?" placeholder: fragment("? ILIKE ?", field, value). Never interpolate user input into the SQL string.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
