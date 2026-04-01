import { describe, it, expect } from 'vitest';
import { createEditVariant } from '../../src/engine/edit-rule-factory.js';
import type { Rule, HookContext } from '../../src/types.js';

// Simple test rule that blocks content containing "BAD_PATTERN"
const testRule: Rule = {
  id: 'test/pattern-check',
  name: 'Test Pattern Check',
  description: 'Blocks content containing BAD_PATTERN',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context) => {
    const content = (context.toolInput.content as string) ?? '';
    if (content.includes('BAD_PATTERN')) {
      return {
        status: 'block',
        ruleId: 'test/pattern-check',
        message: 'BAD_PATTERN detected',
      };
    }
    return { status: 'pass', ruleId: 'test/pattern-check' };
  },
};

function createEditContext(oldString: string, newString: string): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Edit',
    toolInput: {
      file_path: '/project/src/file.ts',
      old_string: oldString,
      new_string: newString,
    },
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

describe('createEditVariant', () => {
  const editRule = createEditVariant(testRule);

  it('should pass when new content is clean', async () => {
    const ctx = createEditContext('old code', 'new clean code');
    const result = await editRule.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should block when BAD_PATTERN is newly introduced', async () => {
    const ctx = createEditContext('clean old code', 'new code with BAD_PATTERN');
    const result = await editRule.check(ctx);
    expect(result.status).toBe('block');
    expect(result.message).toContain('BAD_PATTERN');
  });

  it('should pass when BAD_PATTERN was pre-existing', async () => {
    const ctx = createEditContext(
      'old code with BAD_PATTERN',
      'still has BAD_PATTERN but modified',
    );
    const result = await editRule.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should pass when both old and new are clean', async () => {
    const ctx = createEditContext('clean old', 'clean new');
    const result = await editRule.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should pass when old_string is missing', async () => {
    const ctx = createEditContext('', 'new code with BAD_PATTERN');
    ctx.toolInput.old_string = undefined;
    const result = await editRule.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should pass when new_string is missing', async () => {
    const ctx = createEditContext('old code', '');
    ctx.toolInput.new_string = undefined;
    const result = await editRule.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should set match.tools to Edit', () => {
    expect(editRule.match?.tools).toEqual(['Edit']);
  });
});
