import { describe, it, expect } from 'vitest';
import { bundleSize } from '../../../src/rules/performance/bundle-size.js';
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

describe('performance/bundle-size', () => {
  it('should pass when no heavy imports are present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/date.ts',
        content: `import { format } from 'date-fns';\nimport { debounce } from 'lodash/debounce';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn on full lodash import', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `import _ from 'lodash';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('lodash');
  });

  it('should warn on full moment import', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/date.ts',
        content: `import moment from 'moment';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('moment');
  });

  it('should warn on full rxjs import', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/stream.ts',
        content: `import * as rxjs from 'rxjs';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('rxjs');
  });

  it('should allow lodash sub-path imports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `import debounce from 'lodash/debounce';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should allow lodash-es', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `import { debounce } from 'lodash-es';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should allow rxjs sub-path imports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/stream.ts',
        content: `import { map } from 'rxjs/operators';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `import _ from 'lodash';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: `body { margin: 0; }`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip imports in comments', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `// import _ from 'lodash';\nimport { add } from './math';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should detect multiple heavy imports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `import _ from 'lodash';\nimport moment from 'moment';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.packages).toContain('lodash');
    expect(result.metadata?.packages).toContain('moment');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `import _ from 'lodash';`,
      },
    });
    const result = bundleSize.check(ctx);
    expect(result.fix).toContain('lodash');
  });
});
