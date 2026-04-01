import { describe, it, expect } from 'vitest';
import { noUseClientInPages } from '../../../src/rules/quality/no-use-client-in-pages.js';
import type { HookContext } from '../../../src/types.js';

function createContext(content: string, filePath: string): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { content, file_path: filePath },
    projectConfig: {
      presets: [],
      agents: ['claude-code'],
      rules: new Map(),
    },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('quality/no-use-client-in-pages', () => {
  it('should block "use client" in page.tsx', () => {
    const result = noUseClientInPages.check(
      createContext(
        '"use client";\n\nexport default function Page() {}',
        '/project/src/app/dashboard/page.tsx',
      ),
    );
    expect(result.status).toBe('block');
    expect(result.message).toContain('page');
  });

  it('should block "use client" in layout.tsx', () => {
    const result = noUseClientInPages.check(
      createContext(
        "'use client';\n\nexport default function Layout() {}",
        '/project/src/app/layout.tsx',
      ),
    );
    expect(result.status).toBe('block');
    expect(result.message).toContain('layout');
  });

  it('should allow "use client" in regular components', () => {
    const result = noUseClientInPages.check(
      createContext(
        '"use client";\n\nexport function Button() {}',
        '/project/src/app/components/Button.tsx',
      ),
    );
    expect(result.status).toBe('pass');
  });

  it('should allow pages without "use client"', () => {
    const result = noUseClientInPages.check(
      createContext('export default function Page() {}', '/project/src/app/page.tsx'),
    );
    expect(result.status).toBe('pass');
  });

  it('should skip files not in app directory', () => {
    const result = noUseClientInPages.check(
      createContext(
        '"use client";\n\nexport default function Page() {}',
        '/project/pages/index.tsx',
      ),
    );
    expect(result.status).toBe('pass');
  });

  it('should only check first 5 lines for directive', () => {
    const content = '\n\n\n\n\n\n"use client";\n\nexport default function Page() {}';
    const result = noUseClientInPages.check(createContext(content, '/project/src/app/page.tsx'));
    expect(result.status).toBe('pass'); // "use client" is on line 7, past first 5
  });

  it('should include fix suggestion', () => {
    const result = noUseClientInPages.check(
      createContext(
        '"use client";\nexport default function Page() {}',
        '/project/src/app/page.tsx',
      ),
    );
    expect(result.fix).toContain('Remove');
  });
});
