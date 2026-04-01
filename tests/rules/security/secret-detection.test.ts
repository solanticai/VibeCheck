import { describe, it, expect } from 'vitest';
import { secretDetection } from '../../../src/rules/security/secret-detection.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function createContext(content: string, filePath = '/project/src/config.ts'): HookContext {
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

describe('security/secret-detection', () => {
  it('should pass for normal code', () => {
    const result = secretDetection.check(createContext('const x = 42;\nexport default x;'));
    expect(result.status).toBe('pass');
  });

  it('should detect AWS access keys', () => {
    const result = secretDetection.check(createContext('const key = "AKIAIOSFODNN7EXAMPLE";'));
    expect(result.status).toBe('block');
    expect(result.message).toContain('AWS');
  });

  it('should detect GitHub tokens', () => {
    const result = secretDetection.check(
      createContext('const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";'),
    );
    expect(result.status).toBe('block');
    expect(result.message).toContain('GitHub');
  });

  it('should detect private keys', () => {
    const result = secretDetection.check(
      createContext('-----BEGIN RSA PRIVATE KEY-----\nMIIEowI...'),
    );
    expect(result.status).toBe('block');
    expect(result.message).toContain('Private Key');
  });

  it('should detect Stripe keys', () => {
    const result = secretDetection.check(
      createContext('const stripe = "sk_live_ABCDEFGHIJKLMNOPQRSTUVWXab";'),
    );
    expect(result.status).toBe('block');
    expect(result.message).toContain('Stripe');
  });

  it('should skip .env.example files', () => {
    const result = secretDetection.check(
      createContext('API_KEY=AKIAIOSFODNN7EXAMPLE', '/project/.env.example'),
    );
    expect(result.status).toBe('pass');
  });

  it('should skip package-lock.json', () => {
    const result = secretDetection.check(
      createContext('{"integrity": "sha512-..."}', '/project/package-lock.json'),
    );
    expect(result.status).toBe('pass');
  });

  it('should pass on empty content', () => {
    const result = secretDetection.check(createContext(''));
    expect(result.status).toBe('pass');
  });

  it('should respect allowPatterns config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        [
          'security/secret-detection',
          {
            enabled: true,
            severity: 'block',
            options: { allowPatterns: ['AKIAIOSFODNN7EXAMPLE'] },
          },
        ],
      ]),
    };

    const ctx = createContext('const key = "AKIAIOSFODNN7EXAMPLE";');
    ctx.projectConfig = config;
    const result = secretDetection.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('should include fix suggestion', () => {
    const result = secretDetection.check(createContext('const key = "AKIAIOSFODNN7EXAMPLE";'));
    expect(result.fix).toContain('environment variable');
  });
});
