import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test readStdinSync and parseStdinJson by mocking the low-level readSync
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readSync: vi.fn(),
  };
});

import { readStdinSync, parseStdinJson } from '../../src/utils/stdin.js';
import { readSync } from 'node:fs';

const mockedReadSync = readSync as ReturnType<typeof vi.fn>;

describe('readStdinSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when readSync throws immediately', () => {
    mockedReadSync.mockImplementation(() => {
      throw new Error('EAGAIN');
    });
    expect(readStdinSync()).toBe('');
  });

  it('reads data from stdin until EOF', () => {
    const payload = Buffer.from('{"tool_name":"Edit"}');
    let callCount = 0;
    mockedReadSync.mockImplementation((_fd: number, buf: Buffer, offset: number) => {
      if (callCount === 0) {
        payload.copy(buf, offset);
        callCount++;
        return payload.length;
      }
      return 0; // EOF
    });
    expect(readStdinSync()).toBe('{"tool_name":"Edit"}');
  });

  it('respects the 2MB size limit', () => {
    // Simulate a stream that never stops — readSync keeps returning data
    mockedReadSync.mockImplementation(
      (_fd: number, buf: Buffer, offset: number, length: number) => {
        // Fill the requested length with 'A'
        buf.fill(0x41, offset, offset + length);
        return length;
      },
    );
    const result = readStdinSync();
    // Should be capped at 2MB
    expect(result.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});

describe('parseStdinJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when stdin is empty', () => {
    mockedReadSync.mockImplementation(() => 0);
    expect(parseStdinJson()).toBeNull();
  });

  it('parses valid JSON from stdin', () => {
    const payload = Buffer.from('{"tool_name":"Bash","tool_input":{"command":"ls"}}');
    let called = false;
    mockedReadSync.mockImplementation((_fd: number, buf: Buffer, offset: number) => {
      if (!called) {
        payload.copy(buf, offset);
        called = true;
        return payload.length;
      }
      return 0;
    });
    const result = parseStdinJson();
    expect(result).toEqual({ tool_name: 'Bash', tool_input: { command: 'ls' } });
  });

  it('returns null for invalid JSON', () => {
    const payload = Buffer.from('not json at all');
    let called = false;
    mockedReadSync.mockImplementation((_fd: number, buf: Buffer, offset: number) => {
      if (!called) {
        payload.copy(buf, offset);
        called = true;
        return payload.length;
      }
      return 0;
    });
    expect(parseStdinJson()).toBeNull();
  });
});
