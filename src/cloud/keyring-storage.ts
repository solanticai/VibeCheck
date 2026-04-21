import type { CloudCredentials } from './credentials-types.js';

/**
 * OS-keychain-backed credential storage.
 *
 * Wraps `@napi-rs/keyring` so VGuard can store Cloud credentials in the
 * platform's native secret store instead of a plaintext file under
 * `~/.vguard/credentials.json`:
 *
 *   - Windows → Credential Manager
 *   - macOS   → Keychain
 *   - Linux   → Secret Service (GNOME Keyring, KWallet, libsecret)
 *
 * `@napi-rs/keyring` is an `optionalDependencies` entry. If the native
 * binding fails to install on the user's platform (uncommon but
 * possible on niche targets), `isKeyringAvailable()` returns `false`
 * and callers fall through to the file-based implementation that
 * shipped in #47/#60. No throw at import time.
 *
 * Service / account naming convention:
 *   - service = `vguard`
 *   - account = `credentials` (single-entry per user — VGuard only
 *     ever stores one credential blob per OS user)
 *
 * The payload is the same JSON blob `writeCredentials()` used to dump
 * to disk, so rolling back to file storage is a one-line config flip.
 */

const KEYRING_SERVICE = 'vguard';
const KEYRING_ACCOUNT = 'credentials';

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
}

export interface KeyringModule {
  Entry: new (service: string, account: string) => KeyringEntry;
}

let cachedModule: KeyringModule | null | false = false;

/**
 * Test-only override for the module loader. Passing `null` forces
 * `tryLoadKeyring` to return `null` (simulate native binding absent);
 * passing an object uses it as the keyring module; calling with no
 * args clears the override. Not part of the public contract.
 */
export function __setKeyringForTesting(mod: KeyringModule | null | undefined): void {
  if (mod === undefined) {
    cachedModule = false;
  } else {
    cachedModule = mod ?? null;
  }
}

/**
 * Try to load `@napi-rs/keyring`. Returns `null` and caches the
 * failure on any loader error so we never retry the import per call.
 *
 * `false` as the initial sentinel distinguishes "not yet attempted"
 * from "attempted and failed" (`null`).
 */
function tryLoadKeyring(): KeyringModule | null {
  if (cachedModule !== false) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@napi-rs/keyring') as KeyringModule;
    if (typeof mod.Entry !== 'function') {
      cachedModule = null;
      return null;
    }
    cachedModule = mod;
    return mod;
  } catch {
    cachedModule = null;
    return null;
  }
}

/**
 * Whether the keyring backend is usable on this host right now.
 *
 * Tests both that the native binding loaded *and* that an `Entry`
 * roundtrip survives — on headless Linux without a running Secret
 * Service daemon the module loads but `getPassword` throws. We check
 * by attempting an empty read.
 */
export function isKeyringAvailable(): boolean {
  const mod = tryLoadKeyring();
  if (!mod) return false;
  try {
    const entry = new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
    // Probing an absent password is the smallest possible roundtrip.
    entry.getPassword();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read credentials from the keyring. Returns null if the entry is
 * absent or the keyring is unavailable.
 */
export function readCredentialsFromKeyring(): CloudCredentials | null {
  const mod = tryLoadKeyring();
  if (!mod) return null;
  try {
    const entry = new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
    const raw = entry.getPassword();
    if (!raw) return null;
    return JSON.parse(raw) as CloudCredentials;
  } catch {
    return null;
  }
}

/**
 * Store credentials in the keyring. Returns `true` on success; `false`
 * when the keyring is unavailable or the write failed. Callers must
 * fall back to file storage on `false`.
 */
export function writeCredentialsToKeyring(credentials: CloudCredentials): boolean {
  const mod = tryLoadKeyring();
  if (!mod) return false;
  try {
    const entry = new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
    entry.setPassword(JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove credentials from the keyring. Returns `true` when the entry
 * was present and deleted, `false` otherwise (including when the
 * keyring is unavailable — treat it as "already gone").
 */
export function clearCredentialsFromKeyring(): boolean {
  const mod = tryLoadKeyring();
  if (!mod) return false;
  try {
    const entry = new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT);
    return entry.deletePassword();
  } catch {
    return false;
  }
}
