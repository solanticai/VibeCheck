import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { startDashboardServer } from '../../src/dashboard/index.js';

let tmp: string;
let server: Server | null = null;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-dash-'));
});
afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe('dashboard server', () => {
  it('serves / with an HTML page', async () => {
    server = await startDashboardServer({ projectRoot: tmp, port: 0 });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('VGuard Dashboard');
    expect(text).toContain('new EventSource');
  });

  it('serves /stats as JSON', async () => {
    server = await startDashboardServer({ projectRoot: tmp, port: 0 });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/stats`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const json = await res.json();
    expect(json).toHaveProperty('totalHits');
    expect(json).toHaveProperty('blocks');
  });

  it('returns 404 for unknown paths', async () => {
    server = await startDashboardServer({ projectRoot: tmp, port: 0 });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);
  });
});
