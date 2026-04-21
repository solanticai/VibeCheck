import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  __setKeyringForTesting,
  clearCredentialsFromKeyring,
  isKeyringAvailable,
  readCredentialsFromKeyring,
  writeCredentialsToKeyring,
  type KeyringModule,
} from '../../src/cloud/keyring-storage.js';

const storage = new Map<string, string>();

function makeFakeKeyring(
  options: { getThrows?: boolean; setThrows?: boolean } = {},
): KeyringModule {
  class Entry {
    constructor(
      public service: string,
      public account: string,
    ) {}
    getPassword(): string | null {
      if (options.getThrows) throw new Error('keyring daemon unreachable');
      return storage.get(`${this.service}:${this.account}`) ?? null;
    }
    setPassword(password: string): void {
      if (options.setThrows) throw new Error('write failed');
      storage.set(`${this.service}:${this.account}`, password);
    }
    deletePassword(): boolean {
      return storage.delete(`${this.service}:${this.account}`);
    }
  }
  return { Entry } as KeyringModule;
}

describe('keyring-storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    __setKeyringForTesting(undefined);
  });

  it('isKeyringAvailable returns false when the native binding is absent', () => {
    __setKeyringForTesting(null);
    expect(isKeyringAvailable()).toBe(false);
  });

  it('isKeyringAvailable returns true when a healthy Entry roundtrips', () => {
    __setKeyringForTesting(makeFakeKeyring());
    expect(isKeyringAvailable()).toBe(true);
  });

  it('isKeyringAvailable returns false when getPassword throws (no daemon)', () => {
    __setKeyringForTesting(makeFakeKeyring({ getThrows: true }));
    expect(isKeyringAvailable()).toBe(false);
  });

  it('read / write / delete roundtrip', () => {
    __setKeyringForTesting(makeFakeKeyring());
    expect(readCredentialsFromKeyring()).toBeNull();
    expect(writeCredentialsToKeyring({ apiKey: 'vc_abc123' })).toBe(true);
    expect(readCredentialsFromKeyring()).toEqual({ apiKey: 'vc_abc123' });
    expect(clearCredentialsFromKeyring()).toBe(true);
    expect(readCredentialsFromKeyring()).toBeNull();
  });

  it('write returns false when the native binding is unavailable', () => {
    __setKeyringForTesting(null);
    expect(writeCredentialsToKeyring({ apiKey: 'x' })).toBe(false);
  });

  it('write returns false when setPassword throws', () => {
    __setKeyringForTesting(makeFakeKeyring({ setThrows: true }));
    expect(writeCredentialsToKeyring({ apiKey: 'x' })).toBe(false);
  });

  it('read returns null on malformed stored JSON', () => {
    __setKeyringForTesting(makeFakeKeyring());
    // Bypass the public API to inject invalid JSON into the shared map.
    storage.set('vguard:credentials', 'not json');
    expect(readCredentialsFromKeyring()).toBeNull();
  });

  it('clear returns false when the native binding is unavailable', () => {
    __setKeyringForTesting(null);
    expect(clearCredentialsFromKeyring()).toBe(false);
  });
});
