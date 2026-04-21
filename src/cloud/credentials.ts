import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { sanitiseBaseUrl } from './url-guard.js';
import { restrictCredentialsAcl } from './acl-guard.js';
import type { CloudCredentials } from './credentials-types.js';
import {
  isKeyringAvailable,
  readCredentialsFromKeyring,
  writeCredentialsToKeyring,
  clearCredentialsFromKeyring,
} from './keyring-storage.js';

export type { CloudCredentials } from './credentials-types.js';

const CREDENTIALS_DIR = join(homedir(), '.vguard');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

/**
 * Which backend to use for credential storage.
 *
 *   - `auto` (default) — prefer the OS keyring when available, fall back
 *     to the legacy `~/.vguard/credentials.json` file on platforms where
 *     the native binding failed to install or no secret-service daemon
 *     is running.
 *   - `keyring` — force the keyring path. Returns null / no-op when the
 *     keyring is unavailable, rather than falling back.
 *   - `file` — force the legacy file path. Skips the keyring entirely.
 *
 * Override via `VGUARD_CREDENTIAL_STORE`. Useful in CI (where the
 * keyring daemon often isn't present and the file path is the right
 * choice) and during the transition period while users migrate.
 */
type CredentialBackend = 'auto' | 'keyring' | 'file';

function configuredBackend(): CredentialBackend {
  const raw = process.env.VGUARD_CREDENTIAL_STORE?.toLowerCase();
  if (raw === 'keyring' || raw === 'file' || raw === 'auto') return raw;
  return 'auto';
}

/**
 * Whether the current invocation should attempt to use the keyring.
 * Purely a read of the env var + liveness check — no I/O beyond the
 * keyring's own empty-probe in `isKeyringAvailable`.
 */
function shouldUseKeyring(): boolean {
  const backend = configuredBackend();
  if (backend === 'file') return false;
  if (backend === 'keyring') return true;
  return isKeyringAvailable();
}

/**
 * Read stored Cloud credentials.
 *
 * In `auto` mode: tries the keyring first, falls back to the file.
 * If the keyring is present but empty AND a legacy file exists, the
 * file is migrated into the keyring transparently (first-read
 * migration) — after which the plaintext file is deleted.
 */
export function readCredentials(): CloudCredentials | null {
  const backend = configuredBackend();

  if (backend !== 'file' && shouldUseKeyring()) {
    const fromKeyring = readCredentialsFromKeyring();
    if (fromKeyring) return fromKeyring;
    // Keyring is available but empty. Check for a legacy file and
    // migrate it in. This runs at most once per user — after the
    // migration writes to the keyring, the file is removed.
    if (backend === 'auto' && existsSync(CREDENTIALS_FILE)) {
      const fromFile = readCredentialsFile();
      if (fromFile) {
        if (writeCredentialsToKeyring(fromFile)) {
          // Keyring now holds the data. Drop the plaintext file so
          // reviewers of the home directory don't see stale creds.
          try {
            unlinkSync(CREDENTIALS_FILE);
          } catch {
            // Non-fatal — the file stays but the keyring is the source of truth.
          }
        }
        return fromFile;
      }
    }
    return null;
  }

  return readCredentialsFile();
}

function readCredentialsFile(): CloudCredentials | null {
  try {
    if (!existsSync(CREDENTIALS_FILE)) return null;
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(raw) as CloudCredentials;
  } catch {
    return null;
  }
}

/**
 * Store Cloud credentials.
 *
 * In `auto` mode: writes to the keyring when available, falls back to
 * the legacy file with `mode: 0o600` + `restrictCredentialsAcl` on
 * Windows. On a successful keyring write, any pre-existing plaintext
 * credentials file is removed so secrets don't linger on disk.
 */
export function writeCredentials(credentials: CloudCredentials): void {
  if (shouldUseKeyring()) {
    const wrote = writeCredentialsToKeyring(credentials);
    if (wrote) {
      // Clean up the legacy file if it still exists. Best-effort.
      if (existsSync(CREDENTIALS_FILE)) {
        try {
          unlinkSync(CREDENTIALS_FILE);
        } catch {
          /* legacy file still present — non-fatal */
        }
      }
      return;
    }
    if (configuredBackend() === 'keyring') {
      // Explicitly asked for keyring-only. Refuse to silently write to
      // disk instead — respect the user's intent.
      throw new Error(
        'VGUARD_CREDENTIAL_STORE=keyring but the keyring is unavailable or the write failed. ' +
          'Either start the platform secret service or set VGUARD_CREDENTIAL_STORE=auto/file.',
      );
    }
    // auto mode: fall through to the file path.
  }

  writeCredentialsFile(credentials);
}

function writeCredentialsFile(credentials: CloudCredentials): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  restrictCredentialsAcl(CREDENTIALS_FILE);
}

/**
 * Remove stored Cloud credentials from both backends. `vguard cloud
 * logout` calls this — users expect it to clear credentials regardless
 * of which backend was used to store them, so we clean up both.
 */
export function clearCredentials(): void {
  clearCredentialsFromKeyring();
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      unlinkSync(CREDENTIALS_FILE);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Check if credentials exist (does NOT check expiry — use refreshIfNeeded instead).
 */
export function hasValidCredentials(): boolean {
  const creds = readCredentials();
  return !!creds?.accessToken;
}

/**
 * Check if the access token is expired.
 */
export function isTokenExpired(creds: CloudCredentials): boolean {
  if (!creds.expiresAt) return false;
  return new Date(creds.expiresAt) <= new Date();
}

/**
 * Refresh the access token using the stored refresh token.
 * Updates credentials on disk if successful.
 * Returns the updated credentials or null if refresh fails.
 */
export async function refreshAccessToken(): Promise<CloudCredentials | null> {
  const creds = readCredentials();
  if (!creds?.refreshToken || !creds.supabaseUrl) return null;

  // OAuth client ID — needed for public client refresh per OAuth 2.1 spec
  const clientId = process.env.VGUARD_OAUTH_CLIENT_ID ?? 'd49f2c6e-473a-4b94-acdf-9f282cc9a278';

  let refreshBase: string;
  try {
    refreshBase = sanitiseBaseUrl(creds.supabaseUrl);
  } catch {
    // Malformed / non-allowlisted supabaseUrl — refuse to refresh rather than
    // leak the refresh token to an attacker-controlled host.
    return null;
  }

  try {
    // Use the OAuth token endpoint for refresh (per Supabase OAuth 2.1 docs)
    const res = await fetch(`${refreshBase}/auth/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        client_id: clientId,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user?: { email?: string };
    };

    const updated: CloudCredentials = {
      ...creds,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      email: data.user?.email ?? creds.email,
    };

    writeCredentials(updated);
    return updated;
  } catch {
    return null;
  }
}

/**
 * Get valid credentials, refreshing the token if expired.
 * Returns null if no credentials or refresh fails.
 */
export async function getValidCredentials(): Promise<CloudCredentials | null> {
  const creds = readCredentials();
  if (!creds) return null;

  if (isTokenExpired(creds) && creds.refreshToken) {
    return refreshAccessToken();
  }

  return creds;
}

/**
 * Path where credentials would be written on the file-backend fallback
 * path. Surfaced for `vguard cloud login` success messages and
 * `doctor` output. Users on the keyring backend see this path in
 * documentation; the actual storage is the keychain.
 */
export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}

/**
 * Report which backend `readCredentials` / `writeCredentials` will
 * currently use. Exposed for `doctor` and CLI status output so users
 * can see whether their tokens are in the keyring or on disk.
 */
export function getActiveCredentialBackend(): 'keyring' | 'file' {
  return shouldUseKeyring() ? 'keyring' : 'file';
}
