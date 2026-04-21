import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PATTERNS: Array<[RegExp, string]> = [
  // JS/TS: console|logger.method(<template literal with interpolation>)
  [
    /\b(?:console|logger|log|winston|pino|bunyan)\.(?:info|warn|error|debug|log|trace|fatal)\s*\(\s*`[^`]*\$\{/,
    'Template literal with interpolated user input in log call — use structured logging with a separate data object.',
  ],
  // JS/TS: logger.method('...' + userInput)
  [
    /\b(?:console|logger|log|winston|pino|bunyan)\.(?:info|warn|error|debug|log|trace|fatal)\s*\([^)]*['"][^'"]*['"]\s*\+\s*\w/,
    'String concatenation with variable in log call — use structured logging.',
  ],
  // Python: logger.info(f"...{user_input}...")
  [
    /\b(?:log(?:ger|ging)?)\.(?:info|warn(?:ing)?|error|debug|critical|exception)\s*\(\s*f['"][^'"]*\{/,
    'Python f-string with interpolation in log call — use structured logging: logger.info("event", extra={key: value}).',
  ],
];

/**
 * security/log-injection (CWE-117)
 *
 * Flags log calls that interpolate user input directly into the format
 * string. Veracode Spring 2026 reported 88% of AI-generated scenarios had
 * this pattern. Unsanitised interpolation lets an attacker inject forged
 * log entries and potentially log parser exploits.
 */
export const logInjection: Rule = {
  id: 'security/log-injection',
  name: 'Log Injection Prevention',
  description: 'Warns when log calls interpolate variables directly into the format string.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/log-injection';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    for (const [pattern, message] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'warn',
          ruleId,
          message,
          fix: 'Prefer structured logging: logger.info("event_name", { userId, requestId }) — the logger will serialize values safely.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
