import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { SECRET_PATTERNS } from '../../utils/patterns.js';

const LEAKY_SINK_PATTERNS: RegExp[] = [
  /\bconsole\.(?:log|info|warn|error|debug)\s*\(/,
  /\blogger\.(?:log|info|warn|error|debug)\s*\(/,
  /\bprint\s*\(/,
  /\bresponse\.send\s*\(/,
  /\bres\.(?:json|send)\s*\(/,
  /\bgh\s+issue\s+(?:create|comment)/,
];

const AGENT_OUTPUT_PUBLIC_DESTS: RegExp[] = [
  /\bgh\s+gist\s+create\b/i,
  /\bgh\s+issue\s+(?:create|comment)\b/i,
  /curl[^\n]*https?:\/\/(?:gist|pastebin|transfer|0x0)/i,
];

/**
 * security/secret-in-agent-output
 *
 * Blocks secrets flowing into "leaky" sinks — console.log, gh issue,
 * public gist/pastebin, response body. Distinct from `secret-detection`:
 * this rule fires when a value that *looks* like a secret is being printed
 * or sent somewhere the agent audience can see, even if it passed the
 * initial secret-detection scan. Addresses OWASP LLM02 (Sensitive Info
 * Disclosure).
 */
export const secretInAgentOutput: Rule = {
  id: 'security/secret-in-agent-output',
  name: 'Secret in Agent Output',
  description: 'Blocks secret-shaped values being logged, printed, or sent to public destinations.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Bash'] },

  check: (context): RuleResult => {
    const ruleId = 'security/secret-in-agent-output';
    const tool = context.tool;
    const content = (context.toolInput.content as string) ?? '';
    const command = (context.toolInput.command as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    // Bash path: detect agent output to public gists/pastebins carrying secrets
    if (tool === 'Bash' && command) {
      const publicDest = AGENT_OUTPUT_PUBLIC_DESTS.find((p) => p.test(command));
      if (!publicDest) return { status: 'pass', ruleId };
      const secretHit = SECRET_PATTERNS.find(([, re]) => re.test(command));
      if (!secretHit) return { status: 'pass', ruleId };
      return {
        status: 'block',
        ruleId,
        message: `Command posts secret-shaped content (${secretHit[0]}) to a public destination.`,
        fix: 'Move the secret to an env var and reference it by name in the command, or use a private/authenticated destination.',
      };
    }

    // Write path: detect secrets inside a console.log / logger / print / res.send
    if (tool === 'Write' && content && filePath) {
      const ext = getExtension(filePath);
      if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py'].includes(ext)) {
        return { status: 'pass', ruleId };
      }
      if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!LEAKY_SINK_PATTERNS.some((p) => p.test(line))) continue;
        // Look at this line + 2 following for a secret (covers multi-line args)
        const window = lines.slice(i, Math.min(lines.length, i + 3)).join('\n');
        const secretHit = SECRET_PATTERNS.find(([, re]) => re.test(window));
        if (secretHit) {
          return {
            status: 'block',
            ruleId,
            message: `Secret-shaped value (${secretHit[0]}) inside a logging/response sink.`,
            fix: 'Never log or send raw secrets. Redact with a masking helper, or print only the last 4 characters.',
          };
        }
      }
    }

    return { status: 'pass', ruleId };
  },
};
