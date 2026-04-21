import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

function isK8sManifest(filePath: string, content: string): boolean {
  const ext = getExtension(filePath);
  if (!['yaml', 'yml'].includes(ext)) return false;
  return /^kind\s*:\s*(?:Deployment|Pod|Job|StatefulSet|DaemonSet)\b/m.test(content);
}

export const k8sNoPrivilegedContainers: Rule = {
  id: 'security/k8s-no-privileged-containers',
  name: 'K8s No Privileged Containers',
  description: 'Blocks privileged: true or allowPrivilegeEscalation: true in K8s manifests.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-no-privileged-containers';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!isK8sManifest(filePath, content)) return { status: 'pass', ruleId };

    if (/privileged\s*:\s*true/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'K8s container has privileged:true — full host access.',
        fix: 'Remove privileged:true. Use specific capabilities via securityContext.capabilities.add instead.',
      };
    }
    if (/allowPrivilegeEscalation\s*:\s*true/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'K8s container has allowPrivilegeEscalation:true.',
        fix: 'Set allowPrivilegeEscalation:false explicitly.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
