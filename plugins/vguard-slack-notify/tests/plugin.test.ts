import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import plugin, { blockEventsRule, buildMessage } from '../src/index.js';

describe('@anthril/vguard-slack-notify', () => {
  it('exposes a VGuardPlugin with the expected shape', () => {
    expect(plugin.name).toBe('@anthril/vguard-slack-notify');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(plugin.rules).toHaveLength(1);
    expect(plugin.rules?.[0]).toBe(blockEventsRule);
  });

  it('buildMessage renders a human-readable summary', () => {
    const msg = buildMessage(
      [
        {
          ruleId: 'security/sql-injection',
          status: 'block',
          filePath: 'src/db.ts',
          timestamp: '2026-04-21T00:00:00Z',
        },
      ],
      true,
    );
    expect(msg).toContain('security/sql-injection');
    expect(msg).toContain('src/db.ts');
    expect(msg).toContain('1 block recorded');
  });

  it('truncates the message when there are more than 10 hits', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      ruleId: `r/${i}`,
      status: 'block',
      timestamp: '2026-04-21T00:00:00Z',
    }));
    const msg = buildMessage(many, false);
    expect(msg).toContain('+5 more');
  });
});

describe('blockEventsRule', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('passes when no webhookUrl is configured', async () => {
    const r = await blockEventsRule.check({
      event: 'PostToolUse',
      tool: 'Write',
      toolInput: {},
      projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
      gitContext: {
        branch: 'main',
        isDirty: false,
        repoRoot: '/nonexistent',
        unpushedCount: 0,
        hasRemote: false,
      },
    });
    expect(r.status).toBe('pass');
  });
});
