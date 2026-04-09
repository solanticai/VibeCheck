import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isTokenExpired,
  getValidCredentials,
  refreshAccessToken,
  getCredentialsPath,
  type CloudCredentials,
} from '../../src/cloud/credentials.js';

// Mock the fs module
vi.mock('node:fs', async () => {
  const store = new Map<string, string>();
  return {
    existsSync: vi.fn((p: string) => store.has(p)),
    readFileSync: vi.fn((p: string) => {
      const content = store.get(p);
      if (!content) throw new Error('File not found');
      return content;
    }),
    writeFileSync: vi.fn((p: string, content: string) => {
      store.set(p, content);
    }),
    unlinkSync: vi.fn((p: string) => {
      store.delete(p);
    }),
    mkdirSync: vi.fn(),
  };
});

describe('isTokenExpired', () => {
  it('returns false when expiresAt is not set', () => {
    expect(isTokenExpired({ accessToken: 'tok' })).toBe(false);
  });

  it('returns true when token is in the past', () => {
    expect(isTokenExpired({ expiresAt: '2020-01-01T00:00:00Z' })).toBe(true);
  });

  it('returns false when token is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isTokenExpired({ expiresAt: future })).toBe(false);
  });
});

describe('getCredentialsPath', () => {
  it('returns a string ending with credentials.json', () => {
    const p = getCredentialsPath();
    expect(p).toMatch(/credentials\.json$/);
  });
});

describe('refreshAccessToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null when no credentials exist', async () => {
    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    // Write credentials that have a refresh token
    const { writeFileSync, existsSync } = await import('node:fs');
    const creds: CloudCredentials = {
      accessToken: 'old',
      refreshToken: 'refresh_tok',
      supabaseUrl: 'https://example.supabase.co',
    };
    const credPath = getCredentialsPath();
    (writeFileSync as ReturnType<typeof vi.fn>)(credPath, JSON.stringify(creds));
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p === credPath);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });

  it('returns null when API returns non-ok response', async () => {
    const { writeFileSync, existsSync } = await import('node:fs');
    const creds: CloudCredentials = {
      accessToken: 'old',
      refreshToken: 'refresh_tok',
      supabaseUrl: 'https://example.supabase.co',
    };
    const credPath = getCredentialsPath();
    (writeFileSync as ReturnType<typeof vi.fn>)(credPath, JSON.stringify(creds));
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p === credPath);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });
});

describe('getValidCredentials', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns credentials when token is not expired', async () => {
    const { writeFileSync, existsSync } = await import('node:fs');
    const creds: CloudCredentials = {
      accessToken: 'valid',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const credPath = getCredentialsPath();
    (writeFileSync as ReturnType<typeof vi.fn>)(credPath, JSON.stringify(creds));
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p === credPath);

    const result = await getValidCredentials();
    expect(result).toBeTruthy();
    expect(result?.accessToken).toBe('valid');
  });
});
