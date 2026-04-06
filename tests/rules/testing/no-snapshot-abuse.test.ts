import { describe, it, expect } from 'vitest';
import { noSnapshotAbuse } from '../../../src/rules/testing/no-snapshot-abuse.js';
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
      file_path: '/project/tests/Component.test.tsx',
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

describe('testing/no-snapshot-abuse', () => {
  it('should pass when no snapshots are used', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `it('renders', () => {\n  expect(screen.getByText('Click')).toBeInTheDocument();\n});`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when snapshot count is within limit', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `it('renders', () => {\n  expect(tree).toMatchSnapshot();\n});\nit('renders hover', () => {\n  expect(tree).toMatchSnapshot();\n});`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when snapshot count exceeds limit', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `expect(a).toMatchSnapshot();\nexpect(b).toMatchSnapshot();\nexpect(c).toMatchSnapshot();\nexpect(d).toMatchSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(4);
  });

  it('should count toMatchInlineSnapshot', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `expect(a).toMatchInlineSnapshot();\nexpect(b).toMatchInlineSnapshot();\nexpect(c).toMatchInlineSnapshot();\nexpect(d).toMatchInlineSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(4);
  });

  it('should count both snapshot types together', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `expect(a).toMatchSnapshot();\nexpect(b).toMatchSnapshot();\nexpect(c).toMatchInlineSnapshot();\nexpect(d).toMatchInlineSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(4);
  });

  it('should pass for non-test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `toMatchSnapshot();\ntoMatchSnapshot();\ntoMatchSnapshot();\ntoMatchSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/tests/empty.test.ts', content: '' },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should ignore snapshots in comments', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `// expect(a).toMatchSnapshot();\n// expect(b).toMatchSnapshot();\n// expect(c).toMatchSnapshot();\n// expect(d).toMatchSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should respect custom maxSnapshots config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['testing/no-snapshot-abuse', { enabled: true, severity: 'warn', options: { maxSnapshots: 1 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `expect(a).toMatchSnapshot();\nexpect(b).toMatchSnapshot();`,
      },
      projectConfig: config,
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(2);
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Button.test.tsx',
        content: `expect(a).toMatchSnapshot();\nexpect(b).toMatchSnapshot();\nexpect(c).toMatchSnapshot();\nexpect(d).toMatchSnapshot();`,
      },
    });
    const result = noSnapshotAbuse.check(ctx);
    expect(result.fix).toContain('snapshot');
  });
});
