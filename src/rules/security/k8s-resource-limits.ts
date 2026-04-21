import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

function isK8sWorkload(filePath: string, content: string): boolean {
  const ext = getExtension(filePath);
  if (!['yaml', 'yml'].includes(ext)) return false;
  return (
    /^kind\s*:\s*(?:Deployment|Pod|Job|StatefulSet|DaemonSet)\b/m.test(content) &&
    /containers\s*:/.test(content)
  );
}

export const k8sResourceLimits: Rule = {
  id: 'security/k8s-resource-limits',
  name: 'K8s Resource Limits',
  description: 'Warns when K8s container specs omit resources.limits.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-resource-limits';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!isK8sWorkload(filePath, content)) return { status: 'pass', ruleId };
    if (!/resources\s*:/.test(content) || !/limits\s*:/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'K8s container spec missing resources.limits — cluster-wide DoS risk.',
        fix: 'Add resources: { limits: { cpu: "500m", memory: "512Mi" }, requests: { cpu: "100m", memory: "128Mi" } }.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
