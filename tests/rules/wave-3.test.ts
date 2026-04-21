import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookContext, ResolvedConfig, ResolvedRuleConfig } from '../../src/types.js';
import { lockfileRequired } from '../../src/rules/security/lockfile-required.js';
import { ragSourceAllowlist } from '../../src/rules/security/rag-source-allowlist.js';
import { embeddingSourceIntegrity } from '../../src/rules/security/embedding-source-integrity.js';
import { toolLeastPrivilege } from '../../src/rules/security/tool-least-privilege.js';
import { subagentBoundary } from '../../src/rules/security/subagent-boundary.js';
import { packageExistenceCheck } from '../../src/rules/quality/package-existence-check.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-wave3-'));
});
afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function ctx(
  overrides: Partial<HookContext> & { ruleId?: string; ruleOptions?: ResolvedRuleConfig } = {},
): HookContext {
  const rules = new Map<string, ResolvedRuleConfig>();
  if (overrides.ruleId && overrides.ruleOptions) rules.set(overrides.ruleId, overrides.ruleOptions);
  const projectConfig: ResolvedConfig = { presets: [], agents: ['claude-code'], rules };
  return {
    event: 'PreToolUse',
    tool: 'Bash',
    toolInput: {},
    projectConfig,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: tmp,
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

describe('security/lockfile-required', () => {
  it('blocks npm install <pkg> when package-lock.json exists', async () => {
    writeFileSync(join(tmp, 'package-lock.json'), '{}');
    const r = await lockfileRequired.check(ctx({ toolInput: { command: 'npm install lodash' } }));
    expect(r.status).toBe('block');
  });
  it('passes npm ci', async () => {
    writeFileSync(join(tmp, 'package-lock.json'), '{}');
    const r = await lockfileRequired.check(ctx({ toolInput: { command: 'npm ci' } }));
    expect(r.status).toBe('pass');
  });
  it('passes when no lockfile exists', async () => {
    const r = await lockfileRequired.check(ctx({ toolInput: { command: 'npm install lodash' } }));
    expect(r.status).toBe('pass');
  });
  it('blocks pip install <pkg> when requirements.txt exists', async () => {
    writeFileSync(join(tmp, 'requirements.txt'), '');
    const r = await lockfileRequired.check(ctx({ toolInput: { command: 'pip install requests' } }));
    expect(r.status).toBe('block');
  });
});

describe('security/rag-source-allowlist', () => {
  it('warns on write to memory dir with non-allowlisted URL', async () => {
    const r = await ragSourceAllowlist.check(
      ctx({
        tool: 'Write',
        toolInput: {
          file_path: '/project/.claude/memory/docs.md',
          content: 'Source: https://evil.example.com/doc\n\nContent here',
        },
        ruleId: 'security/rag-source-allowlist',
        ruleOptions: {
          enabled: true,
          severity: 'warn',
          options: { allowedOrigins: ['docs.example.com'] },
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on allowlisted origin', async () => {
    const r = await ragSourceAllowlist.check(
      ctx({
        tool: 'Write',
        toolInput: {
          file_path: '/project/.claude/memory/docs.md',
          content: 'Source: https://docs.example.com/x\n\nContent',
        },
        ruleId: 'security/rag-source-allowlist',
        ruleOptions: {
          enabled: true,
          severity: 'warn',
          options: { allowedOrigins: ['docs.example.com'] },
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/embedding-source-integrity', () => {
  it('warns on embed command without manifest', async () => {
    const r = await embeddingSourceIntegrity.check(
      ctx({ toolInput: { command: 'llamaindex load --source ./docs' } }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when manifest exists', async () => {
    mkdirSync(join(tmp, '.vguard'), { recursive: true });
    writeFileSync(join(tmp, '.vguard', 'embeddings-manifest.json'), '{}');
    const r = await embeddingSourceIntegrity.check(
      ctx({ toolInput: { command: 'llamaindex load --source ./docs' } }),
    );
    expect(r.status).toBe('pass');
  });
  it('passes on non-embed commands', async () => {
    const r = await embeddingSourceIntegrity.check(ctx({ toolInput: { command: 'npm test' } }));
    expect(r.status).toBe('pass');
  });
});

describe('security/tool-least-privilege', () => {
  it('warns on wildcard allowedTools', async () => {
    const r = await toolLeastPrivilege.check(
      ctx({
        tool: 'Write',
        toolInput: {
          file_path: '/p/.claude/settings.json',
          content: '{"allowedTools":["*"],"permission":"default-allow"}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on scoped settings', async () => {
    const r = await toolLeastPrivilege.check(
      ctx({
        tool: 'Write',
        toolInput: {
          file_path: '/p/.claude/settings.json',
          content: '{"allowedTools":["Read","Write","Bash(git .*)"]}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
  it('passes on non-settings files', async () => {
    const r = await toolLeastPrivilege.check(
      ctx({
        tool: 'Write',
        toolInput: { file_path: '/p/src/x.ts', content: '{"allowedTools":["*"]}' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/subagent-boundary', () => {
  it('warns when Task has no allowedTools', async () => {
    const r = await subagentBoundary.check(
      ctx({ tool: 'Task', toolInput: { prompt: 'Summarise this' } }),
    );
    expect(r.status).toBe('warn');
  });
  it('warns when Task prompt is raw user input', async () => {
    const r = await subagentBoundary.check(
      ctx({
        tool: 'Task',
        toolInput: { prompt: '${userInput}', allowedTools: ['Read'] },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when scoped', async () => {
    const r = await subagentBoundary.check(
      ctx({
        tool: 'Task',
        toolInput: {
          allowedTools: ['Read'],
          prompt: 'Please summarise the following: ${userInput}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('quality/package-existence-check', () => {
  it('blocks imports of non-installed packages', async () => {
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    );
    const r = await packageExistenceCheck.check(
      ctx({
        event: 'PostToolUse',
        tool: 'Write',
        toolInput: {
          file_path: '/p/src/x.ts',
          content: 'import foo from "huggingface-cli";',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes declared deps', async () => {
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    );
    const r = await packageExistenceCheck.check(
      ctx({
        event: 'PostToolUse',
        tool: 'Write',
        toolInput: { file_path: '/p/src/x.ts', content: 'import React from "react";' },
      }),
    );
    expect(r.status).toBe('pass');
  });
  it('passes built-in node imports', async () => {
    writeFileSync(join(tmp, 'package.json'), '{}');
    const r = await packageExistenceCheck.check(
      ctx({
        event: 'PostToolUse',
        tool: 'Write',
        toolInput: { file_path: '/p/src/x.ts', content: 'import fs from "node:fs";' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});
