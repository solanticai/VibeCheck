import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

const PERMISSIVE_MARKERS: Array<[RegExp, string]> = [
  [/"allowedTools"\s*:\s*\[\s*"\*"\s*\]/, '"allowedTools" = ["*"] — grants every tool'],
  [/"allow"\s*:\s*\[\s*"Bash\(\.\*\)"\s*\]/, 'unrestricted Bash regex — matches every command'],
  [/"permission"\s*:\s*"default-allow"/, '"permission":"default-allow" — allows by default'],
  [
    /"workspaceRestricted"\s*:\s*false/,
    'workspaceRestricted:false — writes outside the project OK',
  ],
];

function isAgentConfigFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  return (
    /\.claude\/settings(?:\.local)?\.json$/i.test(p) ||
    /\.cursor\/settings\.json$/i.test(p) ||
    /\.codex\/config\.(?:json|toml)$/i.test(p) ||
    /\.opencode\/settings\.json$/i.test(p)
  );
}

/**
 * security/tool-least-privilege
 *
 * Warns at Write-time when an agent settings file grants overly broad
 * permissions (`"*"` tools, unrestricted Bash regex, default-allow,
 * workspaceRestricted:false). Config-level lint for OWASP LLM06
 * (Excessive Agency).
 */
export const toolLeastPrivilege: Rule = {
  id: 'security/tool-least-privilege',
  name: 'Tool Least Privilege',
  description: 'Warns when agent settings grant overly broad permissions.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/tool-least-privilege';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };
    if (!isAgentConfigFile(filePath)) return { status: 'pass', ruleId };

    const hit = PERMISSIVE_MARKERS.find(([re]) => re.test(content));
    if (!hit) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `Agent settings file grants overly broad permissions: ${hit[1]}.`,
      fix: 'Scope permissions to the minimum set needed: replace wildcard tools with an explicit list, restrict Bash regex to the commands you run, keep workspaceRestricted=true.',
      metadata: { marker: hit[0].source },
    };
  },
};
