import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { mergeSettings } from '../../src/adapters/claude-code/settings-merger.js';

describe('settingsMerger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates settings.json when none exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await mergeSettings('/project', {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node .vguard/hooks/vguard-pretooluse.js' }] }],
      },
    });

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('settings.json'),
      expect.stringContaining('hooks'),
      'utf-8',
    );
  });

  it('merges hooks into existing settings.json', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      someOtherSetting: true,
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'echo existing' }] }],
      },
    }));

    await mergeSettings('/project', {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node .vguard/hooks/vguard-pretooluse.js' }] }],
      },
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);

    expect(parsed.someOtherSetting).toBe(true);
    expect(parsed.hooks.PreToolUse).toBeDefined();
  });

  it('preserves non-VGuard hooks', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      hooks: {
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'echo custom-hook' }] },
          { hooks: [{ type: 'command', command: 'node .vguard/hooks/old-hook.js' }] },
        ],
      },
    }));

    await mergeSettings('/project', {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node .vguard/hooks/vguard-pretooluse.js' }] }],
      },
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);

    // Custom hook preserved, old VGuard hook removed, new VGuard hook added
    const hookCommands = parsed.hooks.PreToolUse.flatMap(
      (g: Record<string, unknown>) => {
        const h = g.hooks as Array<{ command: string }>;
        return h.map((x) => x.command);
      },
    );
    expect(hookCommands).toContain('echo custom-hook');
    expect(hookCommands).toContain('node .vguard/hooks/vguard-pretooluse.js');
  });

  it('overwrites stale VGuard hook entries', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      hooks: {
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'node .vguard/hooks/vguard-pretooluse.js' }] },
        ],
      },
    }));

    await mergeSettings('/project', {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node .vguard/hooks/vguard-pretooluse-v2.js' }] }],
      },
    });

    const written = vi.mocked(writeFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);

    // Old VGuard hook should be removed, new one added
    expect(parsed.hooks.PreToolUse).toHaveLength(1);
  });

  it('handles malformed existing settings gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('not-json');

    await mergeSettings('/project', {
      hooks: { PreToolUse: [] },
    });

    expect(writeFile).toHaveBeenCalled();
  });
});
