import { describe, it, expect } from 'vitest';
import { importAliases } from '../../../src/rules/quality/import-aliases.js';
import type { HookContext } from '../../../src/types.js';

function createContext(
  content: string,
  filePath = '/project/src/components/Button.tsx',
): HookContext {
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

describe('quality/import-aliases', () => {
  it('should pass for imports using @/ alias', () => {
    const result = importAliases.check(
      createContext('import { Button } from "@/components/ui/button";'),
    );
    expect(result.status).toBe('pass');
  });

  it('should block imports from "src/" paths', () => {
    const result = importAliases.check(createContext('import { utils } from "src/lib/utils";'));
    expect(result.status).toBe('block');
    expect(result.message).toContain('src/');
  });

  it('should block deep relative imports (4+ levels)', () => {
    const result = importAliases.check(createContext('import { foo } from "../../../../lib/foo";'));
    expect(result.status).toBe('block');
    expect(result.message).toContain('relative');
  });

  it('should allow shallow relative imports', () => {
    const result = importAliases.check(createContext('import { foo } from "../utils/foo";'));
    expect(result.status).toBe('pass');
  });

  it('should skip non-TypeScript files', () => {
    const result = importAliases.check(createContext('from "src/something"', '/project/README.md'));
    expect(result.status).toBe('pass');
  });

  it('should pass for empty content', () => {
    const result = importAliases.check(createContext(''));
    expect(result.status).toBe('pass');
  });

  it('should pass for node_modules imports', () => {
    const result = importAliases.check(createContext('import React from "react";'));
    expect(result.status).toBe('pass');
  });
});
