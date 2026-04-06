import { describe, it, expect } from 'vitest';
import { imageOptimization } from '../../../src/rules/performance/image-optimization.js';
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
      file_path: '/project/src/components/Hero.tsx',
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

describe('performance/image-optimization', () => {
  it('should pass when no <img> tags are present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.tsx',
        content: `export function Hero() {\n  return <div>Hello</div>;\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn on raw <img> tag in JSX', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.tsx',
        content: `export function Hero() {\n  return <img src="/hero.jpg" alt="Hero" />;\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('<img>');
  });

  it('should pass when next/image is imported', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.tsx',
        content: `import Image from 'next/image';\nexport function Hero() {\n  return <img src="/hero.jpg" alt="Hero" />;\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should count multiple <img> tags', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Gallery.tsx',
        content: `export function Gallery() {\n  return (\n    <div>\n      <img src="/a.jpg" alt="A" />\n      <img src="/b.jpg" alt="B" />\n      <img src="/c.jpg" alt="C" />\n    </div>\n  );\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(3);
  });

  it('should pass for non-JSX files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `const imgTag = '<img src="test.jpg" />';`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/Hero.test.tsx',
        content: `render(<img src="/hero.jpg" alt="Hero" />);`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for Storybook stories', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.stories.tsx',
        content: `export default { title: 'Hero' };\nexport const Default = () => <img src="/hero.jpg" />;`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/components/Empty.tsx', content: '' },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should ignore <img> in comments', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.tsx',
        content: `// <img src="/hero.jpg" />\nexport function Hero() {\n  return <div>Hello</div>;\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion for nextjs framework', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/components/Hero.tsx',
        content: `export function Hero() {\n  return <img src="/hero.jpg" alt="Hero" />;\n}`,
      },
    });
    const result = imageOptimization.check(ctx);
    expect(result.fix).toContain('next/image');
  });
});
