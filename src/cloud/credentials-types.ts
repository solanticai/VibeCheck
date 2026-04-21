/**
 * Shape of the Cloud credential blob, stored either in
 * `~/.vguard/credentials.json` (legacy / fallback) or in the OS
 * keyring under service `vguard`, account `credentials` (preferred,
 * opt-in via the keyring follow-up).
 *
 * Extracted into its own module so `credentials.ts` and
 * `keyring-storage.ts` can both import the type without creating a
 * circular dependency between the two storage backends.
 */
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
