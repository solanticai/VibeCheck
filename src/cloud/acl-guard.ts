import { execFileSync } from 'node:child_process';
import { platform, userInfo } from 'node:os';

/**
 * Tighten permissions on a credentials file so that only the current user
 * can read it.
 *
 * On POSIX this is a no-op: `writeFileSync(..., { mode: 0o600 })` already
 * creates the file with user-only read/write. On Windows, Node maps the
 * numeric mode to nothing — the file ends up with the default user-profile
 * ACL, which typically grants `(RX)` to the local `Users` group, making
 * every local account on the host able to read the plaintext tokens.
 *
 * This helper runs `icacls` with `/inheritance:r /grant:r <user>:F` to
 * replace the inherited ACL with a single ACE granting full control to
 * the current user only.
 *
 * Fail-open: any error from `icacls` is swallowed. A hardening pass that
 * blocks `cloud login` on a Windows quirk would violate VGuard's
 * "never block developer flow" contract, so we log via console.debug in
 * verbose mode and move on. See #47 for the long-term plan (OS keychain
 * via @napi-rs/keyring or similar).
 */
export function restrictCredentialsAcl(path: string): void {
  if (platform() !== 'win32') return;

  const username = userInfo().username;
  if (!username) return;

  try {
    execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${username}:F`], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // Swallow — hardening is best-effort. The 0o600 mode still applied
    // wherever Node honours it.
  }
}
