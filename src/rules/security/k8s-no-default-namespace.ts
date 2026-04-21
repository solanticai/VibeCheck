import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const k8sNoDefaultNamespace: Rule = {
  id: 'security/k8s-no-default-namespace',
  name: 'K8s No Default Namespace',
  description: 'Warns when K8s manifests use namespace: default or omit namespace entirely.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-no-default-namespace';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['yaml', 'yml'].includes(ext)) return { status: 'pass', ruleId };
    if (
      !/^kind\s*:\s*(?:Deployment|Pod|Service|Ingress|StatefulSet|DaemonSet|Job|CronJob)\b/m.test(
        content,
      )
    ) {
      return { status: 'pass', ruleId };
    }
    if (/namespace\s*:\s*default\b/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'K8s resource explicitly targets the default namespace.',
        fix: 'Use a project-specific namespace to isolate workloads and RBAC.',
      };
    }
    if (!/namespace\s*:/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message:
          'K8s resource has no namespace — will deploy to the current kubectl context default.',
        fix: 'Set metadata.namespace explicitly to avoid accidental cross-namespace deploys.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
