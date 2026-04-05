/**
 * Session lifecycle event tracker.
 *
 * Claude Code fires SessionStart when a session begins and SessionEnd
 * when it terminates. We record these as JSONL lines so the cloud
 * streamer can later upload them to /api/v1/sessions/events, which
 * uses the events to stamp `started_at`, `ended_at`, and metadata
 * (branch, cli_version, agent, cwd) onto the sessions table.
 *
 * This is a separate channel from rule hits — the cloud ingest endpoint
 * is rule-hit-specific and blocks on session_id being optional.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type SessionEventType = 'start' | 'end';

export interface SessionEventRecord {
  type: SessionEventType;
  sessionId: string;
  timestamp: string;
  branch?: string;
  cliVersion?: string;
  agent?: string;
  cwd?: string;
  metadata?: Record<string, unknown>;
}

const LOG_FILENAME = '.vguard/data/session-events.jsonl';
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB (sessions are low-volume)

/**
 * Append a session lifecycle event to the JSONL log file.
 * Fails open — tracking must never break normal hook operation.
 */
export function recordSessionEvent(
  event: Omit<SessionEventRecord, 'timestamp'> & { timestamp?: string },
  projectRoot: string,
): void {
  try {
    const logPath = join(projectRoot, LOG_FILENAME);
    const dir = dirname(logPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(logPath)) {
      const { size } = statSync(logPath);
      if (size > MAX_LOG_SIZE) {
        renameSync(logPath, logPath + '.old');
      }
    }

    const record: SessionEventRecord = {
      type: event.type,
      sessionId: event.sessionId,
      timestamp: event.timestamp ?? new Date().toISOString(),
      ...(event.branch !== undefined ? { branch: event.branch } : {}),
      ...(event.cliVersion !== undefined ? { cliVersion: event.cliVersion } : {}),
      ...(event.agent !== undefined ? { agent: event.agent } : {}),
      ...(event.cwd !== undefined ? { cwd: event.cwd } : {}),
      ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
    };

    appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Fail open — lifecycle tracking must never interfere with normal operation.
  }
}

export const SESSION_EVENTS_LOG = LOG_FILENAME;
