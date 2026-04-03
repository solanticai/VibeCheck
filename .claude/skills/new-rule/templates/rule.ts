import type { Rule, RuleResult } from '../../types.js';

/**
 * {{RULE_NAME}} rule.
 *
 * {{DESCRIPTION}}
 */
export const {{RULE_VAR_NAME}}: Rule = {
  id: '{{CATEGORY}}/{{RULE_ID}}',
  name: '{{RULE_DISPLAY_NAME}}',
  description: '{{DESCRIPTION}}',
  severity: '{{SEVERITY}}',
  events: [{{EVENTS}}],
  match: {
    tools: [{{TOOLS}}],
    {{#IF_FILE_PATTERNS}}include: [{{FILE_PATTERNS}}],{{/IF_FILE_PATTERNS}}
  },
  editCheck: true, // Auto-generate Edit variant via createEditVariant()

  async check(context): Promise<RuleResult> {
    try {
      const { tool, toolInput } = context;

      // TODO: Implement rule check logic
      // Access tool input properties:
      //   toolInput.file_path — target file path (Edit/Write)
      //   toolInput.content / toolInput.new_string — file content
      //   toolInput.command — bash command (Bash)

      // Example: Check for a pattern in content
      // const content = (toolInput.content ?? toolInput.new_string ?? '') as string;
      // if (VIOLATION_PATTERN.test(content)) {
      //   return {
      //     status: 'block',
      //     message: 'Description of what was found and why it is blocked.',
      //     fix: 'Suggested fix for the developer.',
      //     ruleId: this.id,
      //   };
      // }

      return { status: 'pass', ruleId: '{{CATEGORY}}/{{RULE_ID}}' };
    } catch {
      // Fail-open: internal errors never block the developer
      return { status: 'pass', ruleId: '{{CATEGORY}}/{{RULE_ID}}' };
    }
  },
};
