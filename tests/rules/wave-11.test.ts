import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookContext, ResolvedConfig } from '../../src/types.js';
import { redisNoUnauthenticatedClient } from '../../src/rules/security/redis-no-unauthenticated-client.js';
import { redisNoEvalUserInput } from '../../src/rules/security/redis-no-eval-user-input.js';
import { redisNoKeysStarInProd } from '../../src/rules/security/redis-no-keys-star-in-prod.js';
import { phoenixSobelowRequired } from '../../src/rules/security/phoenix-sobelow-required.js';
import { phoenixMixAuditRequired } from '../../src/rules/security/phoenix-mix-audit-required.js';
import { phoenixLiveviewCsrf } from '../../src/rules/security/phoenix-liveview-csrf.js';
import { phoenixRawSqlFragmentScan } from '../../src/rules/security/phoenix-raw-sql-fragment-scan.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-w11-'));
});
afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  const projectConfig: ResolvedConfig = { presets: [], agents: ['claude-code'], rules: new Map() };
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

// ─── Redis ────────────────────────────────────────────────────────────────

describe('security/redis-no-unauthenticated-client', () => {
  it('warns on unauthenticated redis URL', async () => {
    const r = await redisNoUnauthenticatedClient.check(
      ctx({
        toolInput: {
          file_path: '/p/cache.ts',
          content: 'const client = createClient({ url: "redis://redis.prod.example.com:6379" });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on authenticated URL', async () => {
    const r = await redisNoUnauthenticatedClient.check(
      ctx({
        toolInput: {
          file_path: '/p/cache.ts',
          content:
            'const client = createClient({ url: "redis://:password@redis.prod.example.com:6379" });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/redis-no-eval-user-input', () => {
  it('blocks EVAL with interpolated script', async () => {
    const r = await redisNoEvalUserInput.check(
      ctx({
        toolInput: {
          file_path: '/p/cache.ts',
          content: 'await redis.eval(`return ${userScript}`, 0);',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes EVAL with parameterised script', async () => {
    const r = await redisNoEvalUserInput.check(
      ctx({
        toolInput: {
          file_path: '/p/cache.ts',
          content: 'await redis.eval("return ARGV[1]", 0, userValue);',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/redis-no-keys-star-in-prod', () => {
  it('blocks .keys("*")', async () => {
    const r = await redisNoKeysStarInProd.check(
      ctx({
        toolInput: { file_path: '/p/cache.ts', content: 'const all = await redis.keys("*");' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes SCAN usage', async () => {
    const r = await redisNoKeysStarInProd.check(
      ctx({
        toolInput: {
          file_path: '/p/cache.ts',
          content: 'for await (const key of redis.scanIterator()) { /* ... */ }',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Phoenix / Elixir ─────────────────────────────────────────────────────

describe('security/phoenix-sobelow-required', () => {
  it('warns when Phoenix mix.exs lacks :sobelow', async () => {
    const existing = 'defmodule MyApp.MixProject do\n  def deps, do: [{:phoenix, "~> 1.7"}]\nend\n';
    writeFileSync(join(tmp, 'mix.exs'), existing);
    const r = await phoenixSobelowRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'mix.exs'), content: existing },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when :sobelow present', async () => {
    const existing =
      'defmodule MyApp.MixProject do\n  def deps, do: [{:phoenix, "~> 1.7"}, {:sobelow, "~> 0.13"}]\nend\n';
    writeFileSync(join(tmp, 'mix.exs'), existing);
    const r = await phoenixSobelowRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'mix.exs'), content: existing },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/phoenix-mix-audit-required', () => {
  it('warns when mix.exs lacks :mix_audit', async () => {
    const existing = 'defmodule MyApp.MixProject do\n  def deps, do: [{:phoenix, "~> 1.7"}]\nend\n';
    writeFileSync(join(tmp, 'mix.exs'), existing);
    const r = await phoenixMixAuditRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'mix.exs'), content: existing },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when :mix_audit present', async () => {
    const existing =
      'defmodule MyApp.MixProject do\n  def deps, do: [{:phoenix, "~> 1.7"}, {:mix_audit, "~> 2.0"}]\nend\n';
    writeFileSync(join(tmp, 'mix.exs'), existing);
    const r = await phoenixMixAuditRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'mix.exs'), content: existing },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/phoenix-liveview-csrf', () => {
  it('warns on protect_from_forgery: false', async () => {
    const r = await phoenixLiveviewCsrf.check(
      ctx({
        toolInput: {
          file_path: '/p/lib/my_app_web/endpoint.ex',
          content: 'plug Plug.Protect, protect_from_forgery: false',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on default-protected config', async () => {
    const r = await phoenixLiveviewCsrf.check(
      ctx({
        toolInput: {
          file_path: '/p/lib/my_app_web/endpoint.ex',
          content: 'plug Plug.Protect.CSRFProtection',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/phoenix-raw-sql-fragment-scan', () => {
  it('blocks fragment with interpolation', async () => {
    const r = await phoenixRawSqlFragmentScan.check(
      ctx({
        toolInput: {
          file_path: '/p/lib/my_app/user.ex',
          content: 'from(u in User, where: fragment("name ILIKE \'%#{name}%\'"))',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes parameterised fragment', async () => {
    const r = await phoenixRawSqlFragmentScan.check(
      ctx({
        toolInput: {
          file_path: '/p/lib/my_app/user.ex',
          content: 'from(u in User, where: fragment("? ILIKE ?", u.name, ^value))',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});
