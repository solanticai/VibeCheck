import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSafeCloudUrl, sanitiseBaseUrl } from '../../src/cloud/url-guard.js';

describe('assertSafeCloudUrl', () => {
  const originalEnv = process.env.VGUARD_DEV;

  beforeEach(() => {
    delete process.env.VGUARD_DEV;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VGUARD_DEV;
    } else {
      process.env.VGUARD_DEV = originalEnv;
    }
  });

  describe('allowed hosts', () => {
    it('accepts https://vguard.dev', () => {
      expect(() => assertSafeCloudUrl('https://vguard.dev')).not.toThrow();
    });

    it('accepts https://api.vguard.dev', () => {
      expect(() => assertSafeCloudUrl('https://api.vguard.dev')).not.toThrow();
    });

    it('accepts *.supabase.co hosts', () => {
      expect(() => assertSafeCloudUrl('https://mpisrdadthdhpvgimtzv.supabase.co')).not.toThrow();
      expect(() => assertSafeCloudUrl('https://other.supabase.co')).not.toThrow();
    });

    it('is case insensitive on host', () => {
      expect(() => assertSafeCloudUrl('https://VGUARD.DEV')).not.toThrow();
    });
  });

  describe('scheme enforcement', () => {
    it('rejects http:// on allowlisted hosts', () => {
      expect(() => assertSafeCloudUrl('http://vguard.dev')).toThrow(/must use https/);
    });

    it('rejects ftp://', () => {
      expect(() => assertSafeCloudUrl('ftp://vguard.dev')).toThrow(/must use https/);
    });

    it('rejects javascript: URLs', () => {
      expect(() => assertSafeCloudUrl('javascript:alert(1)')).toThrow();
    });
  });

  describe('userinfo', () => {
    it('rejects user:pass@ in URL', () => {
      expect(() => assertSafeCloudUrl('https://user:pass@vguard.dev')).toThrow(/userinfo/);
    });

    it('rejects bare user@ in URL', () => {
      expect(() => assertSafeCloudUrl('https://user@vguard.dev')).toThrow(/userinfo/);
    });
  });

  describe('foreign hosts', () => {
    it('rejects arbitrary external hosts', () => {
      expect(() => assertSafeCloudUrl('https://evil.example.com')).toThrow(/not allowlisted/);
    });

    it('rejects hosts that only contain supabase.co as a substring', () => {
      expect(() => assertSafeCloudUrl('https://supabase.co.evil.com')).toThrow(/not allowlisted/);
    });

    it('rejects malformed URLs', () => {
      expect(() => assertSafeCloudUrl('not a url')).toThrow(/Invalid cloud URL/);
    });
  });

  describe('VGUARD_DEV escape hatch', () => {
    it('rejects localhost without VGUARD_DEV', () => {
      expect(() => assertSafeCloudUrl('http://localhost:3000')).toThrow(/not allowlisted/);
    });

    it('accepts http://localhost:3000 with VGUARD_DEV=1', () => {
      process.env.VGUARD_DEV = '1';
      expect(() => assertSafeCloudUrl('http://localhost:3000')).not.toThrow();
    });

    it('accepts http://127.0.0.1 with VGUARD_DEV=1', () => {
      process.env.VGUARD_DEV = '1';
      expect(() => assertSafeCloudUrl('http://127.0.0.1:8000')).not.toThrow();
    });

    it('accepts http://192.168.1.5 with VGUARD_DEV=1', () => {
      process.env.VGUARD_DEV = '1';
      expect(() => assertSafeCloudUrl('http://192.168.1.5')).not.toThrow();
    });

    it('accepts https://localhost with VGUARD_DEV=1', () => {
      process.env.VGUARD_DEV = '1';
      expect(() => assertSafeCloudUrl('https://localhost')).not.toThrow();
    });

    it('does not grant access to foreign hosts even with VGUARD_DEV=1', () => {
      process.env.VGUARD_DEV = '1';
      expect(() => assertSafeCloudUrl('https://evil.example.com')).toThrow(/not allowlisted/);
    });
  });
});

describe('sanitiseBaseUrl', () => {
  it('returns URL without trailing slash', () => {
    expect(sanitiseBaseUrl('https://vguard.dev/')).toBe('https://vguard.dev');
  });

  it('preserves URL without trailing slash', () => {
    expect(sanitiseBaseUrl('https://vguard.dev')).toBe('https://vguard.dev');
  });

  it('throws on disallowed URLs', () => {
    expect(() => sanitiseBaseUrl('https://evil.example.com')).toThrow();
  });
});
