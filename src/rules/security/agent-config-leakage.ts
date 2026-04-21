import type { Rule, RuleResult } from '../../types.js';

const AGENT_CONFIG_CONTENT_MARKERS: RegExp[] = [
  /^#\s*VGuard Enforcement Rules/m,
  /VGUARD-POLICY-START/,
  /<\|im_start\|>\s*system/i,
  /^You are Claude(?:\s+Code)?/m,
  /^name:\s*[a-z-]+\s*\ndescription:/m, // SKILL.md frontmatter
  /"mcpServers"\s*:\s*\{/,
];

const PUBLIC_DESTINATION_PATTERNS: RegExp[] = [
  /\bgh\s+gist\s+create\b/i,
  /\bcurl\s+[^\n]*https?:\/\/(?:gist\.github\.com|pastebin\.com|hastebin\.com|dpaste\.com|transfer\.sh|0x0\.st|bashupload\.com)/i,
  /\bnpx?\s+(?:pastebin|haste|transfer)/i,
  /\b(?:slack|discord)\s+(?:webhook|send)/i,
];

const AGENT_CONFIG_FILE_PATTERNS: RegExp[] = [
  /(?:\b|\/)CLAUDE\.md\b/i,
  /(?:\b|\/)AGENTS\.md\b/i,
  /(?:\b|\/)\.cursorrules\b/i,
  /(?:\b|\/)\.mcp\.json\b/i,
  /\.cursor\/rules\//i,
  /\.claude\/(?:memory|rules|settings)\//i,
  /\.opencode\//i,
  /\.codex\//i,
];

/**
 * security/agent-config-leakage
 *
 * Blocks operations that would exfiltrate agent configuration or memory
 * files to a public destination (gist, pastebin, Slack webhook). Detects
 * two patterns:
 *
 *   1. Bash commands reading a known agent-config file and piping/sending
 *      it to a public URL.
 *   2. Write commands whose content matches agent-config shape targeting
 *      a file path outside the project's agent-config directories.
 *
 * Addresses OWASP LLM07 (System Prompt Leakage).
 */
export const agentConfigLeakage: Rule = {
  id: 'security/agent-config-leakage',
  name: 'Agent Config Leakage',
  description:
    'Blocks exfil of CLAUDE.md / AGENTS.md / .mcp.json / rules files to public destinations.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash', 'Write'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/agent-config-leakage';
    const tool = context.tool;
    const command = (context.toolInput.command as string) ?? '';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (tool === 'Bash' && command) {
      const mentionsAgentFile = AGENT_CONFIG_FILE_PATTERNS.some((p) => p.test(command));
      const hasPublicDest = PUBLIC_DESTINATION_PATTERNS.some((p) => p.test(command));
      if (mentionsAgentFile && hasPublicDest) {
        return {
          status: 'block',
          ruleId,
          message: 'Command combines an agent-config file with a public exfil destination.',
          fix: 'Agent configuration files often contain internal URLs, MCP server credentials, and policy-bypass hints. Do not upload them to public paste services or share them via webhook.',
        };
      }
    }

    if (tool === 'Write' && content && filePath) {
      const looksLikeAgentConfig = AGENT_CONFIG_CONTENT_MARKERS.some((p) => p.test(content));
      const isExternalTarget =
        !AGENT_CONFIG_FILE_PATTERNS.some((p) => p.test(filePath)) &&
        /\/(gists?|pastes?|scratch|tmp|uploads?|public)\//i.test(filePath);
      if (looksLikeAgentConfig && isExternalTarget) {
        return {
          status: 'block',
          ruleId,
          message: `Writing agent-config-shaped content to "${filePath}" looks like a leakage path.`,
          fix: "Keep agent-config content inside the project's agent-config directories (CLAUDE.md, .cursor/rules/, etc.).",
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
