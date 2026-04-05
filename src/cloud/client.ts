import { readCredentials, getValidCredentials } from './credentials.js';

const DEFAULT_API_URL = process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev';

export interface CloudClientOptions {
  apiUrl?: string;
  apiKey?: string;
}

export interface CloudApiError {
  code: string;
  message: string;
  status: number;
}

/**
 * Lightweight HTTP client for the VGuard Cloud API.
 * Reads API URL from: options > credentials.apiUrl > VGUARD_CLOUD_URL env > default.
 * Auto-refreshes expired access tokens when a refresh token is stored.
 */
export class CloudClient {
  private apiUrl: string;
  private apiKey?: string;

  constructor(options: CloudClientOptions = {}) {
    const creds = readCredentials();
    const url = options.apiUrl ?? creds?.apiUrl ?? DEFAULT_API_URL;
    this.apiUrl = url.replace(/\/$/, '');
    this.apiKey = options.apiKey;
  }

  /**
   * POST rule hits batch to the ingest endpoint.
   * Uses project API key authentication.
   */
  async ingest(apiKey: string, records: unknown[]): Promise<{ ingested: number }> {
    const body = records.map((r) => JSON.stringify(r)).join('\n');
    const res = await this.request('/api/v1/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'X-API-Key': apiKey,
      },
      body,
    });
    return res as { ingested: number };
  }

  /**
   * Register a project with Cloud.
   * Returns the generated API key (shown once).
   */
  async connectProject(
    name: string,
    repoUrl?: string,
  ): Promise<{ projectId: string; apiKey: string }> {
    return this.authenticatedRequest('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, repoUrl }),
    }) as Promise<{ projectId: string; apiKey: string }>;
  }

  /**
   * Get the current project status.
   */
  async getProjectStatus(projectId: string): Promise<{
    name: string;
    plan: string;
    lastSyncAt: string | null;
    ruleHitsCount: number;
  }> {
    return this.authenticatedRequest(`/api/v1/projects/${projectId}/summary`) as Promise<{
      name: string;
      plan: string;
      lastSyncAt: string | null;
      ruleHitsCount: number;
    }>;
  }

  private async authenticatedRequest(path: string, init?: RequestInit): Promise<unknown> {
    const credentials = await getValidCredentials();
    if (!credentials?.accessToken) {
      throw new Error('Not logged in or session expired. Run `npx vguard cloud login` first.');
    }

    return this.request(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Error(
        `Cannot reach ${this.apiUrl} — ${message}. ` +
          'Set VGUARD_CLOUD_URL or run `npx vguard cloud login` to configure.',
        { cause: err },
      );
    }

    if (!res.ok) {
      let errorMsg: string;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        errorMsg = (body.message ?? body.error ?? body.msg ?? res.statusText) as string;
      } catch {
        errorMsg = res.statusText;
      }
      throw new Error(`Cloud API error (${res.status}): ${errorMsg}`);
    }

    return res.json();
  }
}
