import type { Preset } from '../types.js';

/**
 * Dockerfile preset.
 *
 * Covers the highest-signal AI-Dockerfile failure modes: hardcoded secrets,
 * pipe-to-shell installs, package-name hallucinations, and typosquats.
 *
 * Dockerfile-specific rule scaffolding (no-root-user, pinned-base-digest,
 * no-latest-tag, no-dotenv-copy, multistage-final-slim, healthcheck-defined)
 * is tracked as follow-on work — this preset enables the existing rules
 * that already cover Dockerfile risk surface.
 */
export const dockerfile: Preset = {
  id: 'dockerfile',
  name: 'Dockerfile',
  description:
    'Container image conventions: no secrets, no pipe-to-shell installs, no hallucinated packages.',
  version: '1.0.0',
  rules: {
    'security/secret-detection': true,
    'security/curl-pipe-shell': true,
    'security/package-hallucination-guard': true,
    'security/package-typosquat-guard': true,
    'security/destructive-commands': true,
    'security/no-hardcoded-urls': true,
  },
};
