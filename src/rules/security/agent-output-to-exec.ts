import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const AI_VAR_NAMES = [
  'response',
  'completion',
  'aiOutput',
  'llmOutput',
  'gptResponse',
  'claudeOutput',
  'modelOutput',
  'generated',
  'prompt',
];

const SINK_PATTERNS: RegExp[] = (() => {
  const names = AI_VAR_NAMES.join('|');
  return [
    // JS/TS: eval(<var>), Function(<var>), child_process.exec(<var>)
    new RegExp(`\\beval\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\bnew\\s+Function\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\b(?:child_process|cp)\\.exec(?:Sync)?\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\bexec\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\bspawn\\s*\\(\\s*(?:${names})\\b`),
    // Python: exec(<var>), eval(<var>), os.system(<var>), subprocess.run(<var>)
    new RegExp(`\\bexec\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\bos\\.system\\s*\\(\\s*(?:${names})\\b`),
    new RegExp(`\\bsubprocess\\.(?:run|call|Popen)\\s*\\(\\s*(?:${names})\\b`),
    // Template literal with shell: `cmd ${response}`
    new RegExp(`\`[^\`]*\\$\\{\\s*(?:${names})\\b`),
  ];
})();

/**
 * security/agent-output-to-exec
 *
 * Blocks code that feeds LLM-output-shaped variables (`response`,
 * `completion`, `aiOutput`, etc.) into exec/eval/spawn/os.system sinks.
 * Addresses OWASP LLM05 (Improper Output Handling).
 */
export const agentOutputToExec: Rule = {
  id: 'security/agent-output-to-exec',
  name: 'Agent Output to Exec',
  description: 'Blocks LLM-output-shaped variables from flowing into eval/exec/spawn sinks.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/agent-output-to-exec';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    const hit = SINK_PATTERNS.find((p) => p.test(content));
    if (!hit) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message:
        'LLM-output-shaped variable (response/completion/aiOutput/…) flows into an exec/eval/spawn sink.',
      fix: 'Never pass model output to exec/eval/spawn. Whitelist the set of allowed operations and call them explicitly. If you truly need dynamic dispatch, use a lookup table keyed on validated tokens.',
    };
  },
};
