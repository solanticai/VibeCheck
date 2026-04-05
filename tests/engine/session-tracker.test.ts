import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs to avoid real file operations (mirrors tracker.test.ts).
const mockStore = new Map<string, string>();
vi.mock('node:fs', async () => {
  return {
    existsSync: vi.fn((p: string) => mockStore.has(p)),
    readFileSync: vi.fn((p: string) => {
      const content = mockStore.get(p);
      if (!content) throw new Error('ENOENT');
      return content;
    }),
    appendFileSync: vi.fn((p: string, content: string) => {
      const existing = mockStore.get(p) ?? '';
      mockStore.set(p, existing + content);
    }),
    mkdirSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 100 })),
    renameSync: vi.fn(),
  };
});

const { recordSessionEvent } = await import('../../src/engine/session-tracker.js');

function getEventsLog(): string[] {
  for (const [key, content] of mockStore) {
    if (key.includes('session-events.jsonl') && !key.endsWith('.old')) {
      return content.trim().split('\n').filter(Boolean);
    }
  }
  return [];
}

describe('engine/session-tracker', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('records a SessionStart event with metadata', () => {
    recordSessionEvent(
      {
        type: 'start',
        sessionId: 'sess_abc123',
        timestamp: '2026-04-05T12:00:00Z',
        branch: 'main',
        cliVersion: '1.6.0',
        agent: 'claude-code',
        cwd: '/project',
      },
      '/project',
    );

    const lines = getEventsLog();
    expect(lines).toHaveLength(1);

    const event = JSON.parse(lines[0]);
    expect(event.type).toBe('start');
    expect(event.sessionId).toBe('sess_abc123');
    expect(event.timestamp).toBe('2026-04-05T12:00:00Z');
    expect(event.branch).toBe('main');
    expect(event.cliVersion).toBe('1.6.0');
    expect(event.agent).toBe('claude-code');
    expect(event.cwd).toBe('/project');
  });

  it('records a SessionEnd event with only the core fields', () => {
    recordSessionEvent(
      { type: 'end', sessionId: 'sess_abc123', timestamp: '2026-04-05T13:00:00Z' },
      '/project',
    );

    const lines = getEventsLog();
    expect(lines).toHaveLength(1);

    const event = JSON.parse(lines[0]);
    expect(event.type).toBe('end');
    expect(event.sessionId).toBe('sess_abc123');
    expect(event.timestamp).toBe('2026-04-05T13:00:00Z');
    expect(event.branch).toBeUndefined();
    expect(event.cliVersion).toBeUndefined();
  });

  it('omits optional fields when they are not provided', () => {
    recordSessionEvent({ type: 'start', sessionId: 'sess_x' }, '/project');

    const lines = getEventsLog();
    const event = JSON.parse(lines[0]);
    expect(event.type).toBe('start');
    expect(event.sessionId).toBe('sess_x');
    expect(event.branch).toBeUndefined();
    expect(event.cliVersion).toBeUndefined();
    expect(event.agent).toBeUndefined();
    expect(event.cwd).toBeUndefined();
    expect(event.metadata).toBeUndefined();
    // But a timestamp is always added
    expect(typeof event.timestamp).toBe('string');
  });

  it('appends multiple events to the same log', () => {
    recordSessionEvent({ type: 'start', sessionId: 'sess_1' }, '/project');
    recordSessionEvent({ type: 'end', sessionId: 'sess_1' }, '/project');

    const lines = getEventsLog();
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe('start');
    expect(JSON.parse(lines[1]).type).toBe('end');
  });
});
