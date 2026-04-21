import { describe, it, expect } from 'vitest';
// Side-effect import — ensures all built-in rules are registered.
import '../../src/rules/index.js';
import { getAllRules, getRuleIds } from '../../src/engine/registry.js';

/**
 * Single-source-of-truth smoke test for rule registration across every
 * gap-closure wave. Each ID listed here must appear in the global rule
 * registry after importing `src/rules/index.js`. This catches the case
 * where a rule file exists and compiles but was never added to its
 * category's `index.ts`.
 */

const WAVE_1_RULES = [
  'security/egress-allowlist',
  'security/destructive-scope-guard',
  'security/credential-context-guard',
  'security/agent-config-leakage',
  'security/fetched-content-injection',
  'security/untrusted-context-fence',
  'security/agent-output-to-exec',
  'security/secret-in-agent-output',
  'workflow/autonomy-circuit-breaker',
  'workflow/high-impact-confirm',
];

const WAVE_2_RULES = [
  'mcp/stdio-command-validation',
  'mcp/no-dynamic-tool-registration',
  'mcp/tool-description-sanitize',
  'mcp/capability-disclosure',
  'security/mcp-url-scheme',
  'security/agentsmd-integrity',
  'security/untrusted-tool-registration',
];

const WAVE_3_RULES = [
  'security/lockfile-required',
  'security/rag-source-allowlist',
  'security/embedding-source-integrity',
  'security/tool-least-privilege',
  'security/subagent-boundary',
  'quality/package-existence-check',
];

const WAVE_4_RULES = [
  'security/k8s-run-as-non-root',
  'security/k8s-no-privileged-containers',
  'security/k8s-resource-limits',
  'security/k8s-no-hostpath',
  'security/k8s-image-pinned-digest',
  'security/k8s-no-default-namespace',
  'security/bun-lockfile-integrity',
  'security/bun-shell-exec-scan',
  'security/bun-no-unverified-install',
  'security/mongo-no-operator-injection',
  'security/mongo-no-dollar-where',
  'security/mongo-strict-schema-validation',
  'security/mongo-no-unbound-projection',
];

const WAVE_7_RULES = [
  'security/nestjs-require-guards',
  'security/nestjs-helmet-middleware',
  'security/nestjs-throttler-configured',
  'security/nestjs-class-validator-dtos',
  'security/nuxt-env-var-prefix',
  'security/nuxt-security-headers',
  'quality/nuxt-usestate-per-request',
  'security/trpc-require-input-validation',
  'security/trpc-auth-middleware',
  'security/trpc-no-leaked-server-only',
  'security/zod-server-action-input',
  'quality/zod-no-any-schema',
  'quality/zod-require-strip-or-strict',
];

const WAVE_9_RULES = [
  'security/expo-no-plain-secure-store',
  'security/expo-eas-update-signing',
  'security/expo-config-plugin-review',
  'security/expo-no-experimental-rsc-in-prod',
  'security/graphql-no-introspection-in-prod',
  'security/graphql-depth-limit',
  'security/graphql-complexity-limit',
  'security/graphql-resolver-input-validation',
  'security/deno-permissions-audit',
  'security/deno-import-map-pinning',
  'security/deno-no-eval-ffi',
  'security/grpc-tls-required',
  'security/grpc-auth-interceptor',
  'security/grpc-max-message-size',
  'security/grpc-deadline-propagation',
  'security/rails-mass-assignment-strong-params',
  'security/rails-brakeman-required',
  'security/rails-csp-default-deny',
  'security/rails-encrypted-attr-on-pii',
];

const WAVE_11_RULES = [
  'security/redis-no-unauthenticated-client',
  'security/redis-no-eval-user-input',
  'security/redis-no-keys-star-in-prod',
  'security/phoenix-sobelow-required',
  'security/phoenix-mix-audit-required',
  'security/phoenix-liveview-csrf',
  'security/phoenix-raw-sql-fragment-scan',
];

const ALL_GAP_CLOSURE_RULES = [
  ...WAVE_1_RULES,
  ...WAVE_2_RULES,
  ...WAVE_3_RULES,
  ...WAVE_4_RULES,
  ...WAVE_7_RULES,
  ...WAVE_9_RULES,
  ...WAVE_11_RULES,
];

describe('gap-closure rule registration coverage', () => {
  const registered = new Set(getRuleIds());
  const registry = getAllRules();

  it.each(ALL_GAP_CLOSURE_RULES)('registers %s', (ruleId) => {
    expect(registered.has(ruleId)).toBe(true);
  });

  it('every registered rule has the expected shape', () => {
    for (const ruleId of ALL_GAP_CLOSURE_RULES) {
      const rule = registry.get(ruleId);
      expect(rule, `Missing rule: ${ruleId}`).toBeDefined();
      expect(rule!.id).toBe(ruleId);
      expect(typeof rule!.name).toBe('string');
      expect(typeof rule!.description).toBe('string');
      expect(['block', 'warn', 'info']).toContain(rule!.severity);
      expect(Array.isArray(rule!.events)).toBe(true);
      expect(rule!.events.length).toBeGreaterThan(0);
      expect(typeof rule!.check).toBe('function');
    }
  });

  it('no rule ID is registered twice (would throw on import)', () => {
    // If any collision existed, `import '../../src/rules/index.js'` above
    // would have thrown during module load. Reaching this point proves it.
    expect(registered.size).toBeGreaterThanOrEqual(ALL_GAP_CLOSURE_RULES.length);
  });

  it('total rule count matches expected waves (10+7+6+13+13+19+7 = 75 new rules)', () => {
    const newRuleCount = ALL_GAP_CLOSURE_RULES.length;
    // Wave 7 contributes 13 rules, but the `quality/*` rules
    // (nuxt-usestate-per-request, zod-no-any-schema, zod-require-strip-or-strict)
    // are registered via quality/index.ts, bringing the Wave-7 total visible
    // via the registry to 13 + 3 quality variants already counted. Wave 9
    // contributes 19 rules (4 expo + 4 graphql + 3 deno + 4 grpc + 4 rails).
    expect(newRuleCount).toBe(75);
  });
});
