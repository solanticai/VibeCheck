import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const railsMassAssignmentStrongParams: Rule = {
  id: 'security/rails-mass-assignment-strong-params',
  name: 'Rails Mass Assignment Strong Params',
  description: 'Warns when Rails controllers use params directly without .permit() / .require().',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/rails-mass-assignment-strong-params';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (getExtension(filePath) !== 'rb') return { status: 'pass', ruleId };
    if (!/class\s+\w+Controller/.test(content)) return { status: 'pass', ruleId };
    // e.g. Model.create(params[:foo]) — no .permit
    if (/\b\w+\.(?:create|update|new)\s*\(\s*params\[[^\]]+\]\s*\)/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Rails controller passes raw params to create/update — mass assignment risk.',
        fix: 'Use strong params: `params.require(:user).permit(:name, :email)`.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
