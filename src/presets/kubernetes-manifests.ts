import type { Preset } from '../types.js';

export const kubernetesManifests: Preset = {
  id: 'kubernetes-manifests',
  name: 'Kubernetes Manifests',
  description:
    'K8s YAML conventions: runAsNonRoot, no privileged containers, resource limits, no hostPath, pinned images, explicit namespace.',
  version: '1.0.0',
  rules: {
    'security/k8s-run-as-non-root': true,
    'security/k8s-no-privileged-containers': true,
    'security/k8s-resource-limits': true,
    'security/k8s-no-hostpath': true,
    'security/k8s-image-pinned-digest': true,
    'security/k8s-no-default-namespace': true,
    'security/secret-detection': true,
  },
};
