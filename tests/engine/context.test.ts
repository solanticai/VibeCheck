import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/git.js', () => ({
  buildGitContext: vi.fn(() => ({
    branch: 'feat/test',
    isDirty: false,
    repoRoot: '/project',
    unpushedCount: 0,
    hasRemote: false,
  })),
}));

vi.mock('../../src/utils/validation.js', () => ({
  isValidFilePath: vi.fn((p: string) => !/[;\0|&`$(){}!<>]/.test(p)),
}));

import { buildHookContext } from '../../src/engine/context.js';
import { buildGitContext } from '../../src/utils/git.js';
import { isValidFilePath } from '../../src/utils/validation.js';
import { createResolvedConfig } from '../fixtures/mock-contexts/hook-contexts.js';

describe('buildHookContext', () => {
  const config = createResolvedConfig();

  it('extracts tool name and input from raw data', () => {
    const ctx = buildHookContext('PreToolUse', {
      tool_name: 'Edit',
      tool_input: { file_path: '/project/src/index.ts', old_string: 'a', new_string: 'b' },
    }, config);

    expect(ctx.tool).toBe('Edit');
    expect(ctx.toolInput).toEqual({
      file_path: '/project/src/index.ts',
      old_string: 'a',
      new_string: 'b',
    });
    expect(ctx.event).toBe('PreToolUse');
  });

  it('defaults tool to empty string when missing', () => {
    const ctx = buildHookContext('PreToolUse', {}, config);
    expect(ctx.tool).toBe('');
  });

  it('defaults toolInput to empty object when missing', () => {
    const ctx = buildHookContext('PreToolUse', { tool_name: 'Bash' }, config);
    expect(ctx.toolInput).toEqual({});
  });

  it('reads file_path from toolInput for git context', () => {
    buildHookContext('PreToolUse', {
      tool_name: 'Edit',
      tool_input: { file_path: '/project/src/app.ts' },
    }, config);

    expect(buildGitContext).toHaveBeenCalledWith('/project/src/app.ts');
  });

  it('falls back to path field when file_path missing', () => {
    buildHookContext('PreToolUse', {
      tool_name: 'Read',
      tool_input: { path: '/project/README.md' },
    }, config);

    expect(buildGitContext).toHaveBeenCalledWith('/project/README.md');
  });

  it('falls back to process.cwd() when no path provided', () => {
    buildHookContext('PreToolUse', {
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    }, config);

    expect(buildGitContext).toHaveBeenCalledWith(process.cwd());
  });

  it('rejects file paths with shell metacharacters', () => {
    buildHookContext('PreToolUse', {
      tool_name: 'Edit',
      tool_input: { file_path: '/project/src/index.ts; rm -rf /' },
    }, config);

    expect(isValidFilePath).toHaveBeenCalledWith('/project/src/index.ts; rm -rf /');
    // Falls back to cwd when path is invalid
    expect(buildGitContext).toHaveBeenCalledWith(process.cwd());
  });

  it('passes config through to context', () => {
    const customConfig = createResolvedConfig({ presets: ['nextjs-15'] });
    const ctx = buildHookContext('PreToolUse', { tool_name: 'Edit' }, customConfig);
    expect(ctx.projectConfig).toBe(customConfig);
  });

  it('attaches git context', () => {
    const ctx = buildHookContext('PreToolUse', {
      tool_name: 'Edit',
      tool_input: { file_path: '/project/src/index.ts' },
    }, config);

    expect(ctx.gitContext).toEqual({
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    });
  });
});
