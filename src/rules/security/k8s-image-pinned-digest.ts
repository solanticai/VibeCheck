import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const k8sImagePinnedDigest: Rule = {
  id: 'security/k8s-image-pinned-digest',
  name: 'K8s Image Pinned Digest',
  description: 'Warns when K8s manifests use :latest or un-pinned image tags.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/k8s-image-pinned-digest';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['yaml', 'yml'].includes(ext)) return { status: 'pass', ruleId };
    if (!/^kind\s*:\s*(?:Deployment|Pod|StatefulSet|DaemonSet|Job|CronJob)\b/m.test(content)) {
      return { status: 'pass', ruleId };
    }

    // image: name:latest OR image: name (no tag) OR image: name:tag (no digest)
    const imageLines = content.match(/\bimage\s*:\s*["']?([^"\s]+)["']?/g) ?? [];
    for (const line of imageLines) {
      const m = line.match(/\bimage\s*:\s*["']?([^"\s]+)/);
      if (!m?.[1]) continue;
      const ref = m[1];
      if (ref.includes('@sha256:')) continue; // digest-pinned, safe
      if (ref.endsWith(':latest')) {
        return {
          status: 'warn',
          ruleId,
          message: `Image ${ref} uses :latest — non-reproducible.`,
          fix: 'Pin to a digest: image@sha256:<hash>.',
        };
      }
      if (!ref.includes(':')) {
        return {
          status: 'warn',
          ruleId,
          message: `Image ${ref} has no tag — implicit :latest.`,
          fix: 'Pin to a specific tag or digest.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
