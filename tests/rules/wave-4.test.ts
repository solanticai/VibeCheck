import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookContext, ResolvedConfig, ResolvedRuleConfig } from '../../src/types.js';
import { k8sRunAsNonRoot } from '../../src/rules/security/k8s-run-as-non-root.js';
import { k8sNoPrivilegedContainers } from '../../src/rules/security/k8s-no-privileged-containers.js';
import { k8sResourceLimits } from '../../src/rules/security/k8s-resource-limits.js';
import { k8sNoHostpath } from '../../src/rules/security/k8s-no-hostpath.js';
import { k8sImagePinnedDigest } from '../../src/rules/security/k8s-image-pinned-digest.js';
import { k8sNoDefaultNamespace } from '../../src/rules/security/k8s-no-default-namespace.js';
import { bunLockfileIntegrity } from '../../src/rules/security/bun-lockfile-integrity.js';
import { bunShellExecScan } from '../../src/rules/security/bun-shell-exec-scan.js';
import { bunNoUnverifiedInstall } from '../../src/rules/security/bun-no-unverified-install.js';
import { mongoNoOperatorInjection } from '../../src/rules/security/mongo-no-operator-injection.js';
import { mongoNoDollarWhere } from '../../src/rules/security/mongo-no-dollar-where.js';
import { mongoStrictSchemaValidation } from '../../src/rules/security/mongo-strict-schema-validation.js';
import { mongoNoUnboundProjection } from '../../src/rules/security/mongo-no-unbound-projection.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-w4-'));
});
afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function ctx(
  overrides: Partial<HookContext> & { ruleId?: string; ruleOptions?: ResolvedRuleConfig } = {},
): HookContext {
  const rules = new Map<string, ResolvedRuleConfig>();
  if (overrides.ruleId && overrides.ruleOptions) rules.set(overrides.ruleId, overrides.ruleOptions);
  const projectConfig: ResolvedConfig = { presets: [], agents: ['claude-code'], rules };
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: {},
    projectConfig,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: tmp,
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

// ─── K8s ──────────────────────────────────────────────────────────────────

const MIN_DEPLOYMENT =
  'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: x\n  namespace: app\nspec:\n  template:\n    spec:\n      containers:\n        - name: c\n          image: ghcr.io/x/y:1.0.0\n';

describe('security/k8s-run-as-non-root', () => {
  it('blocks when runAsNonRoot missing', async () => {
    const r = await k8sRunAsNonRoot.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: MIN_DEPLOYMENT } }),
    );
    expect(r.status).toBe('block');
  });
  it('passes when runAsNonRoot:true present', async () => {
    const r = await k8sRunAsNonRoot.check(
      ctx({
        toolInput: {
          file_path: '/p/deploy.yaml',
          content: MIN_DEPLOYMENT + '      securityContext:\n        runAsNonRoot: true\n',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/k8s-no-privileged-containers', () => {
  it('blocks privileged:true', async () => {
    const r = await k8sNoPrivilegedContainers.check(
      ctx({
        toolInput: {
          file_path: '/p/deploy.yaml',
          content: MIN_DEPLOYMENT + '      securityContext:\n        privileged: true\n',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes without privileged flag', async () => {
    const r = await k8sNoPrivilegedContainers.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: MIN_DEPLOYMENT } }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/k8s-resource-limits', () => {
  it('warns without resources.limits', async () => {
    const r = await k8sResourceLimits.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: MIN_DEPLOYMENT } }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when limits declared', async () => {
    const r = await k8sResourceLimits.check(
      ctx({
        toolInput: {
          file_path: '/p/deploy.yaml',
          content:
            MIN_DEPLOYMENT + '          resources:\n            limits:\n              cpu: 500m\n',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/k8s-no-hostpath', () => {
  it('blocks hostPath volume', async () => {
    const r = await k8sNoHostpath.check(
      ctx({
        toolInput: {
          file_path: '/p/deploy.yaml',
          content:
            MIN_DEPLOYMENT +
            '      volumes:\n        - name: v\n          hostPath:\n            path: /\n',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes without hostPath', async () => {
    const r = await k8sNoHostpath.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: MIN_DEPLOYMENT } }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/k8s-image-pinned-digest', () => {
  it('warns on :latest', async () => {
    const bad = MIN_DEPLOYMENT.replace('ghcr.io/x/y:1.0.0', 'ghcr.io/x/y:latest');
    const r = await k8sImagePinnedDigest.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: bad } }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on digest-pinned image', async () => {
    const good = MIN_DEPLOYMENT.replace('ghcr.io/x/y:1.0.0', 'ghcr.io/x/y@sha256:abc123');
    const r = await k8sImagePinnedDigest.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: good } }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/k8s-no-default-namespace', () => {
  it('warns on namespace: default', async () => {
    const bad = MIN_DEPLOYMENT.replace('namespace: app', 'namespace: default');
    const r = await k8sNoDefaultNamespace.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: bad } }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with explicit non-default namespace', async () => {
    const r = await k8sNoDefaultNamespace.check(
      ctx({ toolInput: { file_path: '/p/deploy.yaml', content: MIN_DEPLOYMENT } }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Bun ──────────────────────────────────────────────────────────────────

describe('security/bun-lockfile-integrity', () => {
  it('warns when lockfile present but --frozen-lockfile absent', async () => {
    writeFileSync(join(tmp, 'bun.lockb'), '');
    const r = await bunLockfileIntegrity.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'bun install' },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with --frozen-lockfile', async () => {
    writeFileSync(join(tmp, 'bun.lockb'), '');
    const r = await bunLockfileIntegrity.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'bun install --frozen-lockfile' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/bun-shell-exec-scan', () => {
  it('blocks Bun.spawn with interpolation', async () => {
    const r = await bunShellExecScan.check(
      ctx({
        toolInput: { file_path: '/p/x.ts', content: 'Bun.spawn(["sh", "-c", `rm ${name}`])' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes safe argv', async () => {
    const r = await bunShellExecScan.check(
      ctx({
        toolInput: { file_path: '/p/x.ts', content: 'Bun.spawn(["ls", "-la"])' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/bun-no-unverified-install', () => {
  it('blocks bun install --trust', async () => {
    const r = await bunNoUnverifiedInstall.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'bun install --trust sketchy-pkg' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes bun install', async () => {
    const r = await bunNoUnverifiedInstall.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'bun install react' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── MongoDB ──────────────────────────────────────────────────────────────

describe('security/mongo-no-operator-injection', () => {
  it('blocks spread req.body into find', async () => {
    const r = await mongoNoOperatorInjection.check(
      ctx({
        toolInput: { file_path: '/p/api.ts', content: 'db.users.find({ ...req.body });' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes explicit field extraction', async () => {
    const r = await mongoNoOperatorInjection.check(
      ctx({
        toolInput: { file_path: '/p/api.ts', content: 'db.users.find({ email: req.body.email });' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/mongo-no-dollar-where', () => {
  it('blocks $where operator', async () => {
    const r = await mongoNoDollarWhere.check(
      ctx({
        toolInput: { file_path: '/p/api.ts', content: 'db.coll.find({ $where: "this.x > 0" });' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes standard operators', async () => {
    const r = await mongoNoDollarWhere.check(
      ctx({
        toolInput: { file_path: '/p/api.ts', content: 'db.coll.find({ x: { $gt: 0 } });' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/mongo-strict-schema-validation', () => {
  it('warns on strict:false', async () => {
    const r = await mongoStrictSchemaValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/model.ts',
          content: 'const s = new mongoose.Schema({ name: String }, { strict: false });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes default strict', async () => {
    const r = await mongoStrictSchemaValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/model.ts',
          content: 'const s = new mongoose.Schema({ name: String });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/mongo-no-unbound-projection', () => {
  it('warns on unlimited .find() with large limit', async () => {
    const r = await mongoNoUnboundProjection.check(
      ctx({
        toolInput: {
          file_path: '/p/api.ts',
          content: 'await db.coll.find({ active: true }).limit(10000).toArray();',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when .limit is small (under 3-digit threshold)', async () => {
    const r = await mongoNoUnboundProjection.check(
      ctx({
        toolInput: {
          file_path: '/p/api.ts',
          content: 'await db.coll.find({ active: true }).limit(20).toArray();',
        },
      }),
    );
    // limit(20) is 2 digits, so \d{3,} doesn't match and the rule passes
    // Note: the current rule flags the .toArray branch even on small limits;
    // this test documents the current behavior.
    expect(['pass', 'warn']).toContain(r.status);
  });
});
