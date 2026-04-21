import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { sanitiseBaseUrl } from './url-guard.js';
import { restrictCredentialsAcl } from './acl-guard.js';

const CREDENTIALS_DIR = join(homedir(), '.vguard');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

export interface CloudCredentials {
  /** Supabase access token (JWT) — set by `cloud login`, absent when user
   *  connects via `cloud connect --key` with an existing API key. */
  accessToken?: string;
  /** Supabase refresh token — used to get new access tokens when expired */
  refreshToken?: string;
  /** Token expiry timestamp (ISO 8601) */
  expiresAt?: string;
  /** User email */
  email?: string;
  /** Cloud API URL (stored so CLI knows where to connect) */
  apiUrl?: string;
  /** Supabase project URL (needed for token refresh) */
  supabaseUrl?: string;
  /** Supabase anon/publishable key (needed for token refresh) */
  supabaseAnonKey?: string;
  /** Project API key (vc_ prefix) for syncing rule hits */
  apiKey?: string;
  /** Connected project ID */
  projectId?: string;
}

/**
 * Read stored Cloud credentials.
 */
export function readCredentials(): CloudCredentials | null {
  try {
    if (!existsSync(CREDENTIALS_FILE)) return null;
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(raw) as CloudCredentials;
  } catch {
    return null;
  }
}

/**
 * Store Cloud credentials to disk.
 *
 * The `mode: 0o600` / `0o700` below locks the file on POSIX but is
 * effectively ignored on Windows — Node does not map numeric POSIX modes
 * to NTFS ACLs, so the credentials end up readable by any local user.
 * `restrictCredentialsAcl` closes that gap on Windows via `icacls`.
 */
export function writeCredentials(credentials: CloudCredentials): void {
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
 * Remove stored Cloud credentials.
 */
export function clearCredentials(): void {
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

export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}
