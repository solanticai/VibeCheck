import { readSync } from 'node:fs';

/** Maximum stdin size (2 MB) to prevent memory exhaustion */
const MAX_STDIN_BYTES = 2 * 1024 * 1024;

/**
 * Read data from stdin with a size limit.
 * Returns empty string if stdin is not available or has no data.
 * Reads at most MAX_STDIN_BYTES (2 MB) to prevent DoS via large payloads.
 */
export function readStdinSync(): string {
  try {
    const buf = Buffer.alloc(MAX_STDIN_BYTES);
    let offset = 0;
    let bytesRead: number;
    do {
      try {
        bytesRead = readSync(0, buf, offset, Math.min(4096, MAX_STDIN_BYTES - offset), null);
      } catch {
        break;
      }
      offset += bytesRead;
    } while (bytesRead > 0 && offset < MAX_STDIN_BYTES);
    return buf.toString('utf-8', 0, offset);
  } catch {
    return '';
  }
}

/**
 * Parse JSON from stdin. Returns null on any error.
 * Used by hook scripts to read Claude Code's hook input.
 */
export function parseStdinJson(): Record<string, unknown> | null {
  const raw = readStdinSync();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Extract common tool input fields from hook input data.
 */
export function extractToolInput(data: Record<string, unknown>): {
  toolName: string;
  toolInput: Record<string, unknown>;
} {
  const toolName = (data.tool_name as string) ?? '';
  const toolInput = (data.tool_input as Record<string, unknown>) ?? {};
  return { toolName, toolInput };
}

/**
 * Extract the Claude Code session identifier from a hook payload.
 *
 * Claude Code passes the active session's id as `session_id` in every
 * hook stdin JSON payload. We forward it onto RuleHitRecord + session
 * lifecycle events so the cloud dashboard can group rule hits by
 * session and surface per-session drill-downs.
 *
 * Returns `undefined` when the caller didn't include a session id
 * (e.g. another agent that doesn't support sessions, or malformed input).
 */
export function extractSessionId(data: Record<string, unknown>): string | undefined {
  const sessionId = data.session_id;
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
}
