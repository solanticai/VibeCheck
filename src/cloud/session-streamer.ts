/**
 * Session event streamer.
 *
 * Reads pending session lifecycle events from `.vguard/data/session-events.jsonl`,
 * POSTs them to /api/v1/sessions/events, and advances a cursor so the same
 * events are not re-sent on the next call.
 *
 * Session events are low-volume (a handful per session) so we skip the
 * batching / backoff complexity of the rule-hit streamer. Every flush
 * sends all unsynced events and the server-side upsert is idempotent.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { SessionEventRecord } from '../engine/session-tracker.js';
import { sanitiseBaseUrl } from './url-guard.js';

const EVENTS_FILE = '.vguard/data/session-events.jsonl';
const CURSOR_FILE = '.vguard/data/session-events.cursor.json';
const DEFAULT_TIMEOUT_MS = 3_000;

interface SessionCursor {
  /** ISO timestamp of the last successfully uploaded event */
  lastSyncedAt: string;
}

function readCursor(projectRoot: string): SessionCursor {
  const filePath = join(projectRoot, CURSOR_FILE);
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as SessionCursor;
    }
  } catch {
    // Corrupted — start fresh
  }
  return { lastSyncedAt: new Date(0).toISOString() };
}

function writeCursor(projectRoot: string, cursor: SessionCursor): void {
  const filePath = join(projectRoot, CURSOR_FILE);
  const tmpPath = filePath + '.tmp';
  const dir = dirname(filePath);
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(tmpPath, JSON.stringify(cursor), 'utf-8');
    renameSync(tmpPath, filePath);
  } catch {
    // Non-critical — will retry next call
  }
}

/**
 * Read all session events (current + rotated).
 */
function readSessionEvents(projectRoot: string): SessionEventRecord[] {
  const logPath = join(projectRoot, EVENTS_FILE);
  const oldPath = logPath + '.old';
  const records: SessionEventRecord[] = [];

  const parseFile = (path: string) => {
    try {
      if (!existsSync(path)) return;
      const content = readFileSync(path, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          records.push(JSON.parse(line) as SessionEventRecord);
        } catch {
          // Skip bad lines
        }
      }
    } catch {
      // Fail open
    }
  };

  parseFile(oldPath);
  parseFile(logPath);
  return records;
}

/**
 * Flush any pending session events to the cloud. Fire-and-forget;
 * errors are swallowed. Safe to call on every hook invocation.
 */
export async function flushSessionEvents(
  projectRoot: string,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  try {
    const cursor = readCursor(projectRoot);
    const allEvents = readSessionEvents(projectRoot);
    const cursorTime = new Date(cursor.lastSyncedAt).getTime();

    const pending = allEvents.filter((e) => new Date(e.timestamp).getTime() > cursorTime);

    if (pending.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = pending.map((e) => JSON.stringify(e)).join('\n');
      const url =
        sanitiseBaseUrl(process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev') +
        '/api/v1/sessions/events';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-API-Key': apiKey,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const last = pending[pending.length - 1];
        writeCursor(projectRoot, { lastSyncedAt: last.timestamp });
      }
    } catch {
      clearTimeout(timer);
      // Network error / timeout — try again next call
    }
  } catch {
    // Outer catch — never propagate
  }
}
