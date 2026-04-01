import { describe, it, expect } from 'vitest';
import { analyzeImports } from '../../src/learn/analyzers/imports.js';
import { analyzeNaming } from '../../src/learn/analyzers/naming.js';
import { analyzeStructure } from '../../src/learn/analyzers/structure.js';
import type { WalkedFile } from '../../src/learn/walker.js';

function makeFile(path: string, content: string): WalkedFile {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const directory = parts.slice(0, -1).join('/');
  const ext = filename.split('.').pop() ?? '';
  return { path, content, extension: ext, directory, filename };
}

describe('import analyzer', () => {
  it('should detect path alias usage', () => {
    const files = [
      makeFile(
        '/p/src/components/Button.tsx',
        'import { cn } from "@/lib/utils";\nexport const Button = () => null;',
      ),
      makeFile(
        '/p/src/components/Card.tsx',
        'import { theme } from "@/styles/theme";\nexport const Card = () => null;',
      ),
      makeFile('/p/src/lib/utils.ts', 'export const cn = (...args: string[]) => args.join(" ");'),
    ];
    const result = analyzeImports(files);
    expect(result.patterns.some((p) => p.description.includes('@/'))).toBe(true);
  });

  it('should detect deep relative imports', () => {
    const files = [
      makeFile('/p/src/deep/nested/file.ts', 'import { foo } from "../../../../lib/foo";'),
    ];
    const result = analyzeImports(files);
    expect(result.patterns.some((p) => p.description.includes('deep relative'))).toBe(true);
  });

  it('should detect src/ imports', () => {
    const files = [
      makeFile('/p/src/components/Button.tsx', 'import { utils } from "src/lib/utils";'),
    ];
    const result = analyzeImports(files);
    expect(result.patterns.some((p) => p.description.includes('src/'))).toBe(true);
  });

  it('should report top import sources', () => {
    const files = [
      makeFile(
        '/p/src/App.tsx',
        'import React from "react";\nimport { Button } from "@/components";',
      ),
      makeFile('/p/src/Page.tsx', 'import React from "react";\nimport { cn } from "@/lib/utils";'),
    ];
    const result = analyzeImports(files);
    expect(result.patterns.some((p) => p.description.includes('Top import sources'))).toBe(true);
  });

  it('should return empty patterns for no files', () => {
    const result = analyzeImports([]);
    expect(result.patterns).toHaveLength(0);
  });
});

describe('naming analyzer', () => {
  it('should detect PascalCase in component directories', () => {
    const files = [
      makeFile('/p/src/components/Button.tsx', ''),
      makeFile('/p/src/components/Card.tsx', ''),
      makeFile('/p/src/components/Modal.tsx', ''),
    ];
    const result = analyzeNaming(files);
    expect(result.patterns.some((p) => p.description.includes('PascalCase'))).toBe(true);
  });

  it('should detect use prefix in hook directories', () => {
    const files = [
      makeFile('/p/src/hooks/useAuth.ts', ''),
      makeFile('/p/src/hooks/useFetch.ts', ''),
      makeFile('/p/src/hooks/useTheme.ts', ''),
    ];
    const result = analyzeNaming(files);
    expect(result.patterns.some((p) => p.description.includes('use'))).toBe(true);
  });

  it('should detect dominant naming style', () => {
    const files = [
      makeFile('/p/src/lib/date-utils.ts', ''),
      makeFile('/p/src/lib/string-helpers.ts', ''),
      makeFile('/p/src/lib/api-client.ts', ''),
      makeFile('/p/src/lib/auth-service.ts', ''),
    ];
    const result = analyzeNaming(files);
    expect(result.patterns.some((p) => p.description.includes('kebab-case'))).toBe(true);
  });

  it('should handle empty files array', () => {
    const result = analyzeNaming([]);
    expect(result.patterns).toHaveLength(0);
  });
});

describe('structure analyzer', () => {
  it('should detect Next.js App Router structure', () => {
    const files = [
      makeFile('/p/src/app/page.tsx', 'export default function Page() {}'),
      makeFile('/p/src/app/layout.tsx', 'export default function Layout() {}'),
      makeFile('/p/src/components/Button.tsx', ''),
    ];
    const result = analyzeStructure(files);
    expect(result.patterns.some((p) => p.description.includes('Next.js App Router'))).toBe(true);
  });

  it('should report directory layout', () => {
    const files = [
      makeFile('/p/src/components/A.tsx', ''),
      makeFile('/p/src/components/B.tsx', ''),
      makeFile('/p/src/lib/utils.ts', ''),
    ];
    const result = analyzeStructure(files);
    expect(result.patterns.some((p) => p.description.includes('Directory layout'))).toBe(true);
  });

  it('should handle empty files array', () => {
    const result = analyzeStructure([]);
    expect(result.patterns).toHaveLength(0);
  });
});
