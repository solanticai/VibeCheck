/**
 * Safeguards for URLs that VGuard's cloud layer dials out to.
 *
 * Every URL read from credentials, environment variables, or config runs
 * through `assertSafeCloudUrl`. Relaxing this guard — e.g. adding a new
 * allowlisted host — is a deliberate security decision, not a convenience
 * knob, because rule-hit payloads can contain source-file excerpts and
 * exfiltration via a hijacked endpoint would ship both credentials and code.
 */

const ALLOWED_HOSTS = new Set<string>(['vguard.dev', 'api.vguard.dev']);
const ALLOWED_HOST_SUFFIXES = ['.supabase.co'];

const PRIVATE_IPV4_PREFIXES = ['10.', '127.', '192.168.'];
function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host === '::1') return true;
  if (PRIVATE_IPV4_PREFIXES.some((p) => host.startsWith(p))) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isDevMode(): boolean {
  return process.env.VGUARD_DEV === '1';
}

/**
 * Parse `raw` as a URL and confirm it is safe to dial out to.
 *
 * Rules:
 *   1. Must parse.
 *   2. Must use `https:` — or `http:` with a private host under `VGUARD_DEV=1`.
 *   3. No `user:pass@` userinfo segment (can mask the real host in UIs and logs).
 *   4. Host is in the allowlist, ends with `.supabase.co`, or is private under
 *      `VGUARD_DEV=1`.
 */
export function assertSafeCloudUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid cloud URL: ${raw}`);
  }

  if (url.username || url.password) {
    throw new Error(`Cloud URL must not contain userinfo: ${url.origin}`);
  }

  const host = url.hostname.toLowerCase();
  const allowedByList =
    ALLOWED_HOSTS.has(host) || ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
  const allowedAsPrivate = isDevMode() && isPrivateHost(host);

  if (!allowedByList && !allowedAsPrivate) {
    throw new Error(
      `Cloud URL host '${host}' is not allowlisted. ` +
        `Expected one of: ${[...ALLOWED_HOSTS].join(', ')}, or any *.supabase.co host.`,
    );
  }

  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && allowedAsPrivate) return url;

  throw new Error(
    `Cloud URL must use https:// (got ${url.protocol}//${host}). ` +
      `Set VGUARD_DEV=1 to allow http:// against private hosts for local development.`,
  );
}

/**
 * Normalise `raw` for use as a base URL: validate + strip trailing slash.
 */
export function sanitiseBaseUrl(raw: string): string {
  const url = assertSafeCloudUrl(raw);
  return url.toString().replace(/\/$/, '');
}
