import type { Rule, RuleResult } from '../../types.js';

/**
 * security/subagent-boundary
 *
 * Warns when a parent agent delegates work to a sub-agent via the `Task`
 * tool with either:
 *   - no explicit tool allowlist (wildcard delegation), or
 *   - a prompt field whose value is a raw variable name suggesting it
 *     contains unsanitised user input.
 *
 * Addresses OWASP Agentic ASI07 (Insecure Inter-Agent Communication).
 * Silently no-ops for adapters that do not surface the `Task` tool.
 */
export const subagentBoundary: Rule = {
  id: 'security/subagent-boundary',
  name: 'Sub-agent Boundary',
  description:
    'Warns when a sub-agent is spawned with wildcard tool access or unsanitised prompt input.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Task'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/subagent-boundary';
    const input = context.toolInput;
    const allowedTools = input?.allowedTools;
    const prompt =
      (input?.prompt as string | undefined) ?? (input?.description as string | undefined);
    const messages: string[] = [];

    if (!allowedTools || (Array.isArray(allowedTools) && allowedTools.includes('*'))) {
      messages.push('sub-agent has no tool allowlist (wildcard delegation)');
    }

    if (prompt && /^\s*\$\{?\s*(?:user(?:Input)?|input|request|body)\s*\}?\s*$/i.test(prompt)) {
      messages.push('sub-agent prompt is raw user input (no framing)');
    }

    if (messages.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `Sub-agent boundary concern: ${messages.join('; ')}.`,
      fix: 'Pass an explicit `allowedTools` array to Task(). Frame user input inside your own prompt template rather than passing it as the entire sub-agent instruction.',
      metadata: { findings: messages },
    };
  },
};
