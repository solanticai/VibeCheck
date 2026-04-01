import { describe, it, expect } from 'vitest';
import { namingConventions } from '../../../src/rules/quality/naming-conventions.js';
import type { HookContext } from '../../../src/types.js';

function ctx(filePath: string, content = ''): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { file_path: filePath, content },
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/p',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('quality/naming-conventions', () => {
  it('should block vague filenames', () => {
    const r = namingConventions.check(ctx('/p/src/lib/utils.ts'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('utils.ts');
  });

  it('should allow vague filenames in allowlist', () => {
    const c = ctx('/p/src/lib/utils.ts');
    c.projectConfig.rules.set('quality/naming-conventions', {
      enabled: true,
      severity: 'block',
      options: { allowedVagueFiles: ['src/lib/utils.ts'] },
    });
    const r = namingConventions.check(c);
    expect(r.status).toBe('pass');
  });

  it('should block non-PascalCase component files', () => {
    const r = namingConventions.check(ctx('/p/src/components/my-button.tsx'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('PascalCase');
  });

  it('should allow PascalCase component files', () => {
    const r = namingConventions.check(ctx('/p/src/components/MyButton.tsx'));
    expect(r.status).toBe('pass');
  });

  it('should block hooks without use prefix', () => {
    const r = namingConventions.check(ctx('/p/src/hooks/fetchData.ts'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('use');
  });

  it('should allow hooks with use prefix', () => {
    const r = namingConventions.check(ctx('/p/src/hooks/useAuth.ts'));
    expect(r.status).toBe('pass');
  });

  it('should skip index files in component dirs', () => {
    const r = namingConventions.check(ctx('/p/src/components/index.ts'));
    expect(r.status).toBe('pass');
  });

  it('should pass for files outside component/hook dirs', () => {
    const r = namingConventions.check(ctx('/p/src/lib/my-function.ts'));
    expect(r.status).toBe('pass');
  });
});
