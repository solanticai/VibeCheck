import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { readCredentials, writeCredentials, getCredentialsPath } from '../../cloud/credentials.js';
import { assertSafeCloudUrl } from '../../cloud/url-guard.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { error, info } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

const DEFAULT_CLOUD_URL = process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev';
const DEFAULT_SUPABASE_URL =
  process.env.VGUARD_SUPABASE_URL ?? 'https://mpisrdadthdhpvgimtzv.supabase.co';
const DEFAULT_OAUTH_CLIENT_ID =
  process.env.VGUARD_OAUTH_CLIENT_ID ?? 'd49f2c6e-473a-4b94-acdf-9f282cc9a278';

/**
 * `vguard cloud login`
 *
 * Two modes:
 * 1. Interactive (default): Opens browser for OAuth 2.1 PKCE flow
 * 2. Token (--token): Manual token for CI/headless environments
 */
export async function cloudLoginCommand(
  options: {
    token?: string;
    refreshToken?: string;
    url?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    noInteractive?: boolean;
  } = {},
): Promise<void> {
  printBanner('Cloud Login');

  // Manual token flow (CI/headless)
  if (options.token) {
    return handleTokenLogin(options);
  }

  // Interactive OAuth flow — read from existing credentials, options, or defaults
  const existingCreds = readCredentials();
  const cloudUrl = options.url ?? existingCreds?.apiUrl ?? DEFAULT_CLOUD_URL;
  const supabaseUrl = options.supabaseUrl ?? existingCreds?.supabaseUrl ?? DEFAULT_SUPABASE_URL;
  const clientId = DEFAULT_OAUTH_CLIENT_ID;

  try {
    assertSafeCloudUrl(cloudUrl);
    assertSafeCloudUrl(supabaseUrl);
  } catch (err) {
    error(err instanceof Error ? err.message : 'Invalid cloud URL');
    process.exit(EXIT.USAGE);
  }

  if (options.noInteractive) {
    info('  To authenticate, visit:');
    info(`  ${color.cyan(`${cloudUrl}/cli`)}\n`);
    info('  Sign in, then copy the command shown on that page.\n');
    return;
  }

  try {
    const tokens = await oauthPkceLogin(supabaseUrl, clientId, { cloudUrl });

    // Decode JWT for email and expiry
    let expiresAt: string | undefined;
    let email: string | undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.accessToken.split('.')[1], 'base64').toString(),
      );
      if (payload.exp) expiresAt = new Date(payload.exp * 1000).toISOString();
      email = payload.email;
    } catch {
      // Skip parsing
    }

    writeCredentials({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      email,
      apiUrl: cloudUrl,
      supabaseUrl,
    });

    info(`  ${color.green(glyph('pass'))} Credentials saved to ${getCredentialsPath()}`);
    if (email) info(`  Logged in as ${color.bold(email)}`);
    info(`  API URL: ${cloudUrl}`);
    info(color.dim('  Refresh token stored - sessions will auto-renew.'));
    info('\n  Next step: run `npx vguard cloud connect` to register this project.\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    error(message);

    info('  You can also authenticate manually:');
    info(`  Visit ${cloudUrl}/cli and follow the instructions.\n`);
    process.exit(EXIT.NO_PERM);
  }
}

function handleTokenLogin(options: {
  token?: string;
  refreshToken?: string;
  url?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): void {
  try {
    if (options.url) assertSafeCloudUrl(options.url);
    if (options.supabaseUrl) assertSafeCloudUrl(options.supabaseUrl);
  } catch (err) {
    error(err instanceof Error ? err.message : 'Invalid cloud URL');
    process.exit(EXIT.USAGE);
  }

  let expiresAt: string | undefined;
  let email: string | undefined;
  try {
    const payload = JSON.parse(Buffer.from(options.token!.split('.')[1], 'base64').toString());
    if (payload.exp) expiresAt = new Date(payload.exp * 1000).toISOString();
    email = payload.email;
  } catch {
    // Non-JWT token
  }

  writeCredentials({
    accessToken: options.token!,
    refreshToken: options.refreshToken,
    expiresAt,
    email,
    apiUrl: options.url,
    supabaseUrl: options.supabaseUrl,
    supabaseAnonKey: options.supabaseAnonKey,
  });

  info(`  ${color.green(glyph('pass'))} Credentials saved to ${getCredentialsPath()}`);
  if (email) info(`  Logged in as ${color.bold(email)}`);
  if (options.url) info(`  API URL: ${options.url}`);
  if (options.refreshToken) {
    info(color.dim('  Refresh token stored - sessions will auto-renew.'));
  } else {
    info(color.yellow('  No refresh token - session will expire in ~1 hour.'));
  }
  info('\n  Next step: run `npx vguard cloud connect` to register this project.\n');
}

/**
 * OAuth 2.1 PKCE login flow:
 * 1. Generate code_verifier + code_challenge
 * 2. Start local HTTP server on random port
 * 3. Open browser to Supabase authorize endpoint
 * 4. User authenticates + approves on consent screen
 * 5. Receive authorization code on local callback
 * 6. Exchange code + verifier for tokens
 */
async function oauthPkceLogin(
  supabaseUrl: string,
  clientId: string,
  options?: { cloudUrl?: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  // Generate PKCE pair
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
            '<h2>Login Denied</h2><p>You can close this tab.</p></body></html>',
        );
        server.close();
        reject(new Error(errorDescription ?? `OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
            '<h2>Missing Code</h2><p>No authorization code received.</p></body></html>',
        );
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      // Exchange code for tokens
      try {
        const tokenRes = await fetch(`${supabaseUrl}/auth/v1/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            client_id: clientId,
            redirect_uri: `${cloudHost}/callback`,
          }),
        });

        if (!tokenRes.ok) {
          const errorBody = await tokenRes.text();
          throw new Error(`Token exchange failed: ${errorBody}`);
        }

        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
        };

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
            '<h2 style="color:#16a34a">Logged In!</h2>' +
            '<p>You can close this tab and return to your terminal.</p></body></html>',
        );
        server.close();

        resolve({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
            '<h2>Error</h2><p>Token exchange failed. Check your terminal.</p></body></html>',
        );
        server.close();
        reject(err instanceof Error ? err : new Error('Token exchange failed'));
      }
    });

    const CLI_CALLBACK_PORT = 3030;
    // redirect_uri must exactly match what's registered in Supabase: http://localhost:3000/callback
    // The dashboard /callback route relays the code to the CLI's local server via the state param
    const cloudHost = options?.cloudUrl ?? DEFAULT_CLOUD_URL;
    server.listen(CLI_CALLBACK_PORT, () => {
      const redirectUri = `${cloudHost}/callback`;

      const authUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', String(CLI_CALLBACK_PORT));
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('scope', 'openid email');

      // Open browser cross-platform
      // On Windows, cmd /c start breaks URLs with & in query strings,
      // so use PowerShell's Start-Process or rundll32 instead
      const openUrl = authUrl.toString();

      if (process.platform === 'win32') {
        execFile('rundll32', ['url.dll,FileProtocolHandler', openUrl], (err) => {
          if (err) {
            info(`  Could not open browser. Visit this URL manually:`);
            info(`  ${openUrl}\n`);
          }
        });
      } else {
        const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        execFile(openCmd, [openUrl], (err) => {
          if (err) {
            info(`  Could not open browser. Visit this URL manually:`);
            info(`  ${openUrl}\n`);
          }
        });
      }

      info('  Opening browser for authentication...');
      info(color.dim('  Waiting for approval...\n'));
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 5 minutes'));
    }, 300_000);

    server.on('close', () => clearTimeout(timeout));
  });
}
