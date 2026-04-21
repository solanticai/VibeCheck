import type { Preset } from '../types.js';

/**
 * Terraform preset.
 *
 * Targets the highest-cost AI-Terraform failure modes: hardcoded secrets
 * in HCL, world-readable state, wildcard IAM actions, installs via
 * pipe-to-shell in provisioners. HCL-specific rule scaffolding
 * (s3-public-access-block, require-encryption, remote-state-required,
 * iam-no-wildcard-actions) is tracked as follow-on — this preset bundles
 * the rules that already cover universal Terraform risks.
 */
export const terraform: Preset = {
  id: 'terraform',
  name: 'Terraform',
  description:
    'Terraform / HCL conventions: no secrets, no pipe-to-shell provisioners, no hallucinated providers.',
  version: '1.0.0',
  rules: {
    'security/secret-detection': true,
    'security/curl-pipe-shell': true,
    'security/package-hallucination-guard': true,
    'security/no-hardcoded-urls': true,
    'workflow/require-changelog-on-protected-branches': true,
  },
};
