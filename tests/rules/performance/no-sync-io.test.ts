import { describe, it, expect } from 'vitest';
import { noSyncIo } from '../../../src/rules/performance/no-sync-io.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };

  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: {
      file_path: '/project/src/utils/helpers.ts',
      content: '',
    },
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

describe('performance/no-sync-io', () => {
  it('should pass when no sync IO is present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `import { readFile } from 'fs/promises';\nawait readFile('data.json');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn on readFileSync', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `const data = readFileSync('data.json', 'utf-8');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('readFileSync');
  });

  it('should warn on execSync', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/shell.ts',
        content: `const output = execSync('ls -la');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('execSync');
  });

  it('should warn on writeFileSync', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `writeFileSync('output.json', JSON.stringify(data));`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('writeFileSync');
  });

  it('should warn on existsSync', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `if (existsSync(path)) { doSomething(); }`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('existsSync');
  });

  it('should detect multiple sync methods', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `readFileSync('a');\nwriteFileSync('b', data);`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.syncMethods).toContain('readFileSync');
    expect(result.metadata?.syncMethods).toContain('writeFileSync');
  });

  it('should allow in scripts/ directory by default', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/scripts/seed.ts',
        content: `readFileSync('data.json');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should allow in config files by default', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/next.config.ts',
        content: `readFileSync('version.txt');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/file.test.ts',
        content: `readFileSync('fixture.json');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip sync IO in comments', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `// readFileSync('data.json');\nconst x = 5;`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/file.ts',
        content: `readFileSync('data.json');`,
      },
    });
    const result = noSyncIo.check(ctx);
    expect(result.fix).toContain('async');
  });
});
