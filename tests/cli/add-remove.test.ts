import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('../../src/presets/index.js', () => ({}));
vi.mock('../../src/rules/index.js', () => ({}));

vi.mock('../../src/engine/registry.js', () => ({
  hasRule: vi.fn(),
}));

vi.mock('../../src/config/presets.js', () => ({
  hasPreset: vi.fn(),
}));

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { hasRule } from '../../src/engine/registry.js';
import { hasPreset } from '../../src/config/presets.js';
import { addCommand } from '../../src/cli/commands/add.js';

describe('addCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('errors when no config found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(hasRule).mockReturnValue(true);

    await expect(addCommand('security/branch-protection')).rejects.toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No VGuard config found'));
  });

  it('rejects unknown rule ID', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('.vguardrc.json')) return true;
      return false;
    });
    vi.mocked(hasRule).mockReturnValue(false);

    await expect(addCommand('nonexistent/rule')).rejects.toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown rule'));
  });

  it('adds a rule to JSON config', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('.vguardrc.json')) return true;
      return false;
    });
    vi.mocked(hasRule).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('{"presets": [], "rules": {}}');

    await addCommand('security/secret-detection');

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.vguardrc.json'),
      expect.stringContaining('security/secret-detection'),
      'utf-8',
    );
  });

  it('adds a preset to JSON config', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('.vguardrc.json')) return true;
      return false;
    });
    vi.mocked(hasPreset).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('{"presets": [], "rules": {}}');

    await addCommand('preset:nextjs-15');

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.vguardrc.json'),
      expect.stringContaining('nextjs-15'),
      'utf-8',
    );
  });

  it('rejects unknown preset ID', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('.vguardrc.json')) return true;
      return false;
    });
    vi.mocked(hasPreset).mockReturnValue(false);

    await expect(addCommand('preset:nonexistent')).rejects.toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown preset'));
  });
});
