import { readCredentials, getValidCredentials } from './credentials.js';
import { sanitiseBaseUrl } from './url-guard.js';
import type { ProjectConfigPushPayload } from '../types.js';

const DEFAULT_API_URL = process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev';
/**
 * Base URL for Supabase Edge Functions. These live on a different host
 * from the main Next.js app. Override via VGUARD_FUNCTIONS_URL for
 * self-hosted Supabase instances or preview environments.
 */
const DEFAULT_FUNCTIONS_URL =
  process.env.VGUARD_FUNCTIONS_URL ?? 'https://mpisrdadthdhpvgimtzv.supabase.co';

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
    this.apiUrl = sanitiseBaseUrl(url);
    this.apiKey = options.apiKey;
  }

  /**
   * POST a resolved config snapshot + vguard version to the
   * ingest-config Edge Function so the dashboard can populate its
   * presets / rules / version widgets for this project. Uses project
   * API key authentication (same X-API-Key as `ingest()`).
   *
   * The endpoint lives on the Supabase Edge Function host, not on the
   * main API host — hence the separate base URL.
   */
  async pushConfigSnapshot(
    apiKey: string,
    payload: ProjectConfigPushPayload,
    timeoutMs = 5_000,
  ): Promise<{ updated: boolean; projectId: string }> {
    const url = sanitiseBaseUrl(DEFAULT_FUNCTIONS_URL) + '/functions/v1/ingest-config';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(`Config push failed (${res.status}): ${errBody.message ?? res.statusText}`);
      }
      return (await res.json()) as { updated: boolean; projectId: string };
    } finally {
      clearTimeout(timer);
    }
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
   * POST session lifecycle events (start/end) to the sessions endpoint.
   * Uses project API key authentication. Events are NDJSON.
   */
  async postSessionEvents(
    apiKey: string,
    events: unknown[],
  ): Promise<{ processed: number; starts: number; ends: number }> {
    const body = events.map((e) => JSON.stringify(e)).join('\n');
    const res = await this.request('/api/v1/sessions/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'X-API-Key': apiKey,
      },
      body,
    });
    return res as { processed: number; starts: number; ends: number };
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
