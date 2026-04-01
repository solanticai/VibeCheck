import { describe, it, expect, vi } from 'vitest';
import { formatOnSave } from '../../../src/rules/workflow/format-on-save.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

// Mock existsSync to control which config files "exist"
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      const normalized = p.replace(/\\/g, '/');
      // Simulate a project with .prettierrc
      if (normalized.endsWith('/.prettierrc')) return true;
      // Simulate pyproject.toml for Python
      if (normalized.endsWith('/pyproject.toml')) return true;
      return false;
    }),
  };
});

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };

  return {
    event: 'PostToolUse',
    tool: 'Write',
    toolInput: { file_path: '/project/src/index.ts', content: '' },
    projectConfig: defaultConfig,
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

describe('workflow/format-on-save', () => {
  it('should suggest Prettier for TypeScript files when .prettierrc exists', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/index.ts' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('Prettier');
    expect(result.metadata?.command).toContain('prettier');
  });

  it('should suggest gofmt for Go files', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/main.go' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('gofmt');
  });

  it('should suggest rustfmt for Rust files', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/main.rs' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('rustfmt');
  });

  it('should suggest Black for Python files when pyproject.toml exists', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/app.py' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('Black');
  });

  it('should pass when no formatter is detected for unknown file types', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/data.csv' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when file_path is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '' },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when not in a git repo', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/index.ts' },
      gitContext: {
        branch: null,
        isDirty: false,
        repoRoot: null,
        unpushedCount: 0,
        hasRemote: false,
      },
    });
    const result = formatOnSave.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include formatter info in metadata', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/index.ts' },
    });
    const result = formatOnSave.check(ctx);
    expect(result.metadata?.formatter).toBeDefined();
    expect(result.metadata?.command).toBeDefined();
  });
});
