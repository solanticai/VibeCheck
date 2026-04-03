import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/cloud/credentials.js', () => ({
  readCredentials: vi.fn(() => null),
  getValidCredentials: vi.fn(() => null),
}));

import { getValidCredentials } from '../../src/cloud/credentials.js';
import { CloudClient } from '../../src/cloud/client.js';

describe('CloudClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  it('constructs with default API URL', () => {
    const client = new CloudClient();
    expect(client).toBeDefined();
  });

  it('sends authenticated ingest request with API key', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ingested: 5 }),
    });

    const client = new CloudClient();
    const result = await client.ingest('test-api-key', [{ ruleId: 'test', status: 'block' }]);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ingest'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'test-api-key',
          'Content-Type': 'application/x-ndjson',
        }),
      }),
    );
    expect(result.ingested).toBe(5);
  });

  it('handles 401 responses', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Invalid API key' }),
    });

    const client = new CloudClient();
    await expect(client.ingest('bad-key', [])).rejects.toThrow('Cloud API error (401)');
  });

  it('handles network errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const client = new CloudClient();
    await expect(client.ingest('key', [])).rejects.toThrow('Cannot reach');
  });

  it('requires authentication for connectProject', async () => {
    vi.mocked(getValidCredentials).mockResolvedValue(null);

    const client = new CloudClient();
    await expect(client.connectProject('my-project')).rejects.toThrow('Not logged in');
  });

  it('makes authenticated request when credentials exist', async () => {
    vi.mocked(getValidCredentials).mockResolvedValue({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3600000,
    } as Awaited<ReturnType<typeof getValidCredentials>>);

    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projectId: 'proj_123', apiKey: 'key_abc' }),
    });

    const client = new CloudClient();
    const result = await client.connectProject('my-project');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(result).toHaveProperty('projectId');
  });
});
