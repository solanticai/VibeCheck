import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const k8sNoHostpath: Rule = {
  id: 'security/k8s-no-hostpath',
  name: 'K8s No HostPath',
  description: 'Blocks hostPath volumes — mount the host filesystem into the pod.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-no-hostpath';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['yaml', 'yml'].includes(ext)) return { status: 'pass', ruleId };
    if (!/^kind\s*:\s*(?:Deployment|Pod|StatefulSet|DaemonSet)\b/m.test(content)) {
      return { status: 'pass', ruleId };
    }
    if (/\bhostPath\s*:/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'K8s volume uses hostPath — mounts host filesystem into the pod.',
        fix: 'Use configMap / secret / emptyDir / PVC volumes instead. hostPath breaks pod isolation.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
