import { describe, it, expect } from 'vitest';
import compliance, {
  sbomUpToDate,
  sbomSigValid,
  euCra2026,
} from '../../plugins/vguard-compliance-sbom/src/index.js';
import sastBridge, {
  sastSemgrep,
  sastBandit,
  sastBrakeman,
  sastSobelow,
  sastStandard,
  binAvailable,
} from '../../plugins/vguard-sast-bridge/src/index.js';
import type { HookContext, ResolvedConfig } from '../../src/types.js';

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  const projectConfig: ResolvedConfig = { presets: [], agents: ['claude-code'], rules: new Map() };
  return {
    event: 'Stop',
    tool: 'Write',
    toolInput: {},
    projectConfig,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: '/nonexistent',
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

describe('@anthril/vguard-compliance-sbom', () => {
  it('exposes plugin + rules + preset', () => {
    expect(compliance.name).toBe('@anthril/vguard-compliance-sbom');
    expect(compliance.rules?.map((r) => r.id).sort()).toEqual([
      'sbom/sig-valid',
      'sbom/up-to-date',
    ]);
    expect(compliance.presets?.[0]).toBe(euCra2026);
  });

  it('sbom/up-to-date passes when no repo root', async () => {
    const r = await sbomUpToDate.check(
      ctx({
        gitContext: {
          branch: null,
          isDirty: false,
          repoRoot: null,
          unpushedCount: 0,
          hasRemote: false,
        },
      }),
    );
    expect(r.status).toBe('pass');
  });

  it('sbom/sig-valid passes when SBOM file is absent', async () => {
    const r = await sbomSigValid.check(ctx());
    expect(r.status).toBe('pass');
  });
});

describe('@anthril/vguard-sast-bridge', () => {
  it('exposes four wrapper rules and sast-standard preset', () => {
    expect(sastBridge.name).toBe('@anthril/vguard-sast-bridge');
    expect(sastBridge.rules?.map((r) => r.id).sort()).toEqual([
      'sast/bandit',
      'sast/brakeman',
      'sast/semgrep',
      'sast/sobelow',
    ]);
    expect(sastStandard.id).toBe('sast-standard');
  });

  it('binAvailable returns boolean', () => {
    expect(typeof binAvailable('definitely-not-a-real-binary')).toBe('boolean');
  });

  it('rules pass when tool binaries are absent', async () => {
    const r1 = await sastSemgrep.check(
      ctx({ event: 'PostToolUse', toolInput: { file_path: '/p/x.ts' } }),
    );
    const r2 = await sastBandit.check(
      ctx({ event: 'PostToolUse', toolInput: { file_path: '/p/x.py' } }),
    );
    const r3 = await sastBrakeman.check(
      ctx({ event: 'PostToolUse', toolInput: { file_path: '/p/x.rb' } }),
    );
    const r4 = await sastSobelow.check(
      ctx({ event: 'PostToolUse', toolInput: { file_path: '/p/x.ex' } }),
    );
    expect([r1.status, r2.status, r3.status, r4.status]).toEqual(['pass', 'pass', 'pass', 'pass']);
  });

  it('rules skip unrelated file extensions', async () => {
    const r = await sastBandit.check(
      ctx({ event: 'PostToolUse', toolInput: { file_path: '/p/x.ts' } }),
    );
    expect(r.status).toBe('pass');
  });
});
