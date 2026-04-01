import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { writeCredentials, getCredentialsPath } from '../../cloud/credentials.js';

const DEFAULT_CLOUD_URL = process.env.VIBECHECK_CLOUD_URL ?? 'https://app.vibecheck.dev';
const DEFAULT_SUPABASE_URL =
  process.env.VIBECHECK_SUPABASE_URL ?? 'https://mpisrdadthdhpvgimtzv.supabase.co';
const DEFAULT_OAUTH_CLIENT_ID =
  process.env.VIBECHECK_OAUTH_CLIENT_ID ?? 'd49f2c6e-473a-4b94-acdf-9f282cc9a278';

/**
 * `vibecheck cloud login`
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
  console.log('\n  VibeCheck Cloud — Login\n');

  // Manual token flow (CI/headless)
  if (options.token) {
    return handleTokenLogin(options);
  }

  // Interactive OAuth flow
  const cloudUrl = options.url ?? DEFAULT_CLOUD_URL;
  const supabaseUrl = options.supabaseUrl ?? DEFAULT_SUPABASE_URL;
  const clientId = DEFAULT_OAUTH_CLIENT_ID;

  if (options.noInteractive) {
    console.log('  To authenticate, visit:');
    console.log(`  ${cloudUrl}/cli\n`);
    console.log('  Sign in, then copy the command shown on that page.\n');
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

    console.log(`  Credentials saved to ${getCredentialsPath()}`);
    if (email) console.log(`  Logged in as ${email}`);
    console.log(`  API URL: ${cloudUrl}`);
    console.log('  Refresh token stored — sessions will auto-renew.');
    console.log('\n  Next step: run `npx vibecheck cloud connect` to register this project.\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error(`  ${message}\n`);

    // Fall back to manual flow
    console.log('  You can also authenticate manually:');
    console.log(`  Visit ${cloudUrl}/cli and follow the instructions.\n`);
    process.exit(1);
  }
}

function handleTokenLogin(options: {
  token?: string;
  refreshToken?: string;
  url?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): void {
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

  console.log(`  Credentials saved to ${getCredentialsPath()}`);
  if (email) console.log(`  Logged in as ${email}`);
  if (options.url) console.log(`  API URL: ${options.url}`);
  if (options.refreshToken) {
    console.log('  Refresh token stored — sessions will auto-renew.');
  } else {
    console.log('  No refresh token — session will expire in ~1 hour.');
  }
  console.log('\n  Next step: run `npx vibecheck cloud connect` to register this project.\n');
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
            redirect_uri: `${cloudHost}/auth/callback/cli?cli_port=${CLI_CALLBACK_PORT}`,
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
    // Supabase redirect_uri must match what's registered: the dashboard URL
    // The dashboard /auth/callback/cli route will forward the code to the CLI's local server
    const cloudHost = options?.cloudUrl ?? 'http://localhost:3000';
    server.listen(CLI_CALLBACK_PORT, () => {
      const redirectUri = `${cloudHost}/auth/callback/cli?cli_port=${CLI_CALLBACK_PORT}`;

      const authUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
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
            console.log(`  Could not open browser. Visit this URL manually:`);
            console.log(`  ${openUrl}\n`);
          }
        });
      } else {
        const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        execFile(openCmd, [openUrl], (err) => {
          if (err) {
            console.log(`  Could not open browser. Visit this URL manually:`);
            console.log(`  ${openUrl}\n`);
          }
        });
      }

      console.log('  Opening browser for authentication...');
      console.log('  Waiting for approval...\n');
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 5 minutes'));
    }, 300_000);

    server.on('close', () => clearTimeout(timeout));
  });
}
