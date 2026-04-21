import type { Rule, RuleResult } from '../../types.js';

/**
 * Extended pipe-to-shell patterns that go beyond the basic
 * `destructive-commands` list — PowerShell `iex (iwr ...)`, `eval "$(curl ...)"`,
 * process substitution, and `sh -c "$(...)"`.
 */
const PIPE_SHELL_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:curl|wget|fetch)\b[^\n|]{0,400}?\|\s*(?:sudo\s+)?(?:sh|bash|zsh|ksh|pwsh|iex)\b/i,
    'Pipe-to-shell detected (curl/wget/fetch → sh/bash/zsh/pwsh/iex).',
  ],
  [
    /\b(?:Invoke-WebRequest|iwr|Invoke-RestMethod|irm)\b[^\n|]{0,400}?\|\s*(?:iex|Invoke-Expression)\b/i,
    'PowerShell remote-execute detected (iwr/irm → iex).',
  ],
  [
    /\beval\s+"\$\(\s*(?:curl|wget|fetch)\b/i,
    'eval "$(curl …)" detected — executes remote content as shell.',
  ],
  [
    /\b(?:sh|bash|zsh)\s+-c\s+"\$\(\s*(?:curl|wget|fetch)\b/i,
    'sh -c "$(curl …)" detected — executes remote content as shell.',
  ],
  [
    /<\(\s*(?:curl|wget|fetch)\b/i,
    'Process substitution from remote fetch detected — executes remote content.',
  ],
];

/**
 * security/curl-pipe-shell
 *
 * Blocks natural-language-driven RCE via piping remote content to a shell
 * interpreter. Covers bash pipes, PowerShell iex, eval `$()`, sh -c `$()`,
 * and process substitution. Extends `destructive-commands`.
 * Maps to OWASP Agentic ASI05 (Unexpected Code Execution).
 */
export const curlPipeShell: Rule = {
  id: 'security/curl-pipe-shell',
  name: 'Curl-Pipe-Shell Prevention',
  description:
    'Blocks piping remote content to a shell (curl|sh, iex (iwr …), eval "$(curl …)", etc.).',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/curl-pipe-shell';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    for (const [pattern, message] of PIPE_SHELL_PATTERNS) {
      if (pattern.test(command)) {
        return {
          status: 'block',
          ruleId,
          message,
          fix: 'Download the script first, inspect it, verify its checksum, then execute. Never pipe unverified remote content directly to a shell interpreter.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
