import { describe, it, expect } from 'vitest';
import { antiPatterns } from '../../../src/rules/quality/anti-patterns.js';
import type { HookContext } from '../../../src/types.js';

function ctx(
  content: string,
  filePath: string,
  options: Record<string, unknown> = {},
): HookContext {
  const rules = new Map();
  if (Object.keys(options).length > 0) {
    rules.set('quality/anti-patterns', { enabled: true, severity: 'warn', options });
  }
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { content, file_path: filePath },
    projectConfig: { presets: [], agents: ['claude-code'], rules },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/p',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('quality/anti-patterns', () => {
  it('should warn on CSS files when blockCssFiles enabled', () => {
    const r = antiPatterns.check(
      ctx('.button { color: red; }', '/p/src/styles/button.css', { blockCssFiles: true }),
    );
    expect(r.status).toBe('warn');
    expect(r.message).toContain('CSS');
  });

  it('should allow globals.css even when blockCssFiles enabled', () => {
    const r = antiPatterns.check(
      ctx('* { margin: 0; }', '/p/src/globals.css', { blockCssFiles: true }),
    );
    expect(r.status).toBe('pass');
  });

  it('should warn on inline styles when blockInlineStyles enabled', () => {
    const r = antiPatterns.check(
      ctx('<div style={{ color: "red" }}>', '/p/src/App.tsx', { blockInlineStyles: true }),
    );
    expect(r.status).toBe('warn');
    expect(r.message).toContain('Inline styles');
  });

  it('should warn on console.log when blockConsoleLog enabled', () => {
    const r = antiPatterns.check(
      ctx('console.log("debug");', '/p/src/api.ts', { blockConsoleLog: true }),
    );
    expect(r.status).toBe('warn');
    expect(r.message).toContain('console.log');
  });

  it('should skip console.log in test files', () => {
    const r = antiPatterns.check(
      ctx('console.log("debug");', '/p/src/api.test.ts', { blockConsoleLog: true }),
    );
    expect(r.status).toBe('pass');
  });

  it('should pass when no anti-pattern options enabled', () => {
    const r = antiPatterns.check(ctx('.button { color: red; }', '/p/src/styles/button.css'));
    expect(r.status).toBe('pass');
  });
});
