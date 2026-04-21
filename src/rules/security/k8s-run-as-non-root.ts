import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

function isK8sManifest(filePath: string, content: string): boolean {
  const ext = getExtension(filePath);
  if (!['yaml', 'yml'].includes(ext)) return false;
  return (
    /^apiVersion\s*:\s*(?:apps\/v1|v1|batch\/v1)/m.test(content) &&
    /^kind\s*:\s*(?:Deployment|Pod|Job|StatefulSet|DaemonSet|ReplicaSet|CronJob)\b/m.test(content)
  );
}

/**
 * security/k8s-run-as-non-root (kubernetes-manifests preset)
 *
 * Blocks workload manifests that don't set `runAsNonRoot: true` on the
 * pod or container security context. Matches Kubescape 4.0 CIS check.
 */
export const k8sRunAsNonRoot: Rule = {
  id: 'security/k8s-run-as-non-root',
  name: 'K8s Run As Non-Root',
  description: 'Blocks K8s workloads that do not set runAsNonRoot:true.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-run-as-non-root';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!isK8sManifest(filePath, content)) return { status: 'pass', ruleId };
    if (/runAsNonRoot\s*:\s*true/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'block',
      ruleId,
      message: 'K8s workload manifest missing runAsNonRoot:true.',
      fix: 'Add securityContext: { runAsNonRoot: true, runAsUser: 1000 } at the pod or container level.',
    };
  },
};
