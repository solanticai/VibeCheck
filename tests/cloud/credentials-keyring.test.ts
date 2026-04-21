import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { KeyringModule } from '../../src/cloud/keyring-storage.js';

// Redirect $HOME so `credentials.ts` writes to a tmp dir instead of the
// developer's real `~/.vguard`. `credentials.ts` calls `homedir()` at
// module init (for the `const CREDENTIALS_DIR`), so the env var must be
// set before import — we use `vi.resetModules` + dynamic import.
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalBackend = process.env.VGUARD_CREDENTIAL_STORE;

let tmpHome: string;

const fakeStorage = new Map<string, string>();

function makeFakeKeyring(): KeyringModule {
  class Entry {
    constructor(
      public service: string,
      public account: string,
    ) {}
    getPassword(): string | null {
      return fakeStorage.get(`${this.service}:${this.account}`) ?? null;
    }
    setPassword(password: string): void {
      fakeStorage.set(`${this.service}:${this.account}`, password);
    }
    deletePassword(): boolean {
      return fakeStorage.delete(`${this.service}:${this.account}`);
    }
  }
  return { Entry } as KeyringModule;
}

async function loadCredentialsModule(
  backend: 'auto' | 'keyring' | 'file',
  keyring: KeyringModule | null = makeFakeKeyring(),
) {
  vi.resetModules();
  process.env.VGUARD_CREDENTIAL_STORE = backend;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;

  // Re-import keyring-storage on the freshly reset module graph, then
  // inject our fake before loading credentials. The `credentials.ts`
  // module reads the keyring-storage singleton at runtime so the
  // injection here is what its calls will see.
  const ks = await import('../../src/cloud/keyring-storage.js');
  ks.__setKeyringForTesting(keyring);
  return await import('../../src/cloud/credentials.js');
}

describe('credentials backend selection', () => {
  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'vguard-creds-test-'));
    fakeStorage.clear();
  });

  afterEach(async () => {
    if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
    // Reset the keyring-storage module's injected state so it doesn't
    // leak into other test files that happen to import the same module.
    const ks = await import('../../src/cloud/keyring-storage.js');
    ks.__setKeyringForTesting(undefined);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    if (originalBackend === undefined) delete process.env.VGUARD_CREDENTIAL_STORE;
    else process.env.VGUARD_CREDENTIAL_STORE = originalBackend;
  });

  it('auto backend writes to keyring when available (no plaintext file)', async () => {
    const mod = await loadCredentialsModule('auto');
    mod.writeCredentials({ apiKey: 'vc_from_auto' });
    expect(fakeStorage.get('vguard:credentials')).toContain('vc_from_auto');
    expect(existsSync(join(tmpHome, '.vguard', 'credentials.json'))).toBe(false);
    expect(mod.getActiveCredentialBackend()).toBe('keyring');
  });

  it('auto backend reads from keyring', async () => {
    fakeStorage.set('vguard:credentials', JSON.stringify({ apiKey: 'vc_preloaded' }));
    const mod = await loadCredentialsModule('auto');
    expect(mod.readCredentials()).toEqual({ apiKey: 'vc_preloaded' });
  });

  it('auto backend migrates legacy file into keyring on first read', async () => {
    // Keyring empty; legacy file present.
    const credDir = join(tmpHome, '.vguard');
    mkdirSync(credDir, { recursive: true });
    const credFile = join(credDir, 'credentials.json');
    writeFileSync(credFile, JSON.stringify({ apiKey: 'vc_legacy' }));

    const mod = await loadCredentialsModule('auto');
    const out = mod.readCredentials();
    expect(out).toEqual({ apiKey: 'vc_legacy' });
    // Migration: now in keyring, file removed.
    expect(fakeStorage.get('vguard:credentials')).toContain('vc_legacy');
    expect(existsSync(credFile)).toBe(false);
  });

  it('file backend ignores the keyring entirely', async () => {
    fakeStorage.set('vguard:credentials', JSON.stringify({ apiKey: 'vc_keyring_only' }));
    const mod = await loadCredentialsModule('file');
    expect(mod.readCredentials()).toBeNull();
    expect(mod.getActiveCredentialBackend()).toBe('file');
  });

  it('file backend writes to disk with no keyring touch', async () => {
    const mod = await loadCredentialsModule('file');
    mod.writeCredentials({ apiKey: 'vc_file_only' });
    expect(existsSync(join(tmpHome, '.vguard', 'credentials.json'))).toBe(true);
    expect(fakeStorage.size).toBe(0);
  });

  it('keyring backend throws when keyring unavailable', async () => {
    const mod = await loadCredentialsModule('keyring', null);
    expect(() => mod.writeCredentials({ apiKey: 'x' })).toThrow(/keyring/i);
  });

  it('clearCredentials wipes both backends', async () => {
    fakeStorage.set('vguard:credentials', JSON.stringify({ apiKey: 'vc_in_keyring' }));
    const credDir = join(tmpHome, '.vguard');
    mkdirSync(credDir, { recursive: true });
    writeFileSync(join(credDir, 'credentials.json'), JSON.stringify({ apiKey: 'vc_on_disk' }));

    const mod = await loadCredentialsModule('auto');
    mod.clearCredentials();

    expect(fakeStorage.size).toBe(0);
    expect(existsSync(join(credDir, 'credentials.json'))).toBe(false);
  });
});
