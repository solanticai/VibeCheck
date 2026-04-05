import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { CloudConfig } from '../types.js';
import { readRuleHits } from '../engine/tracker.js';
import { readSyncCursor, writeSyncCursor, getUnsyncedRecords, applyExclusions } from './sync.js';

const FLUSH_STATE_FILE = '.vguard/data/flush-state.json';

/** Defaults for streaming configuration */
const DEFAULTS = {
  batchSize: 10,
  flushIntervalMs: 5_000,
  timeoutMs: 2_000,
  maxConsecutiveFailures: 10,
} as const;

/** Backoff schedule in ms after consecutive failures: 30s, 60s, 120s, 300s (max) */
const BACKOFF_SCHEDULE = [30_000, 60_000, 120_000, 300_000];

/** Persisted state between short-lived hook processes */
interface FlushState {
  /** Number of rule hits recorded since last successful flush */
  pendingCount: number;
  /** ISO timestamp of last successful flush */
  lastFlushAt: string;
  /** Number of consecutive flush failures */
  consecutiveFailures: number;
  /** ISO timestamp — do not attempt flush before this time */
  backoffUntil: string | null;
}

function readFlushState(projectRoot: string): FlushState {
  const filePath = join(projectRoot, FLUSH_STATE_FILE);
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as FlushState;
    }
  } catch {
    // Corrupted file — reset
  }
  return {
    pendingCount: 0,
    lastFlushAt: new Date(0).toISOString(),
    consecutiveFailures: 0,
    backoffUntil: null,
  };
}

/**
 * Write flush state atomically via temp file + rename.
 * Rename is atomic on all major filesystems, so concurrent readers
 * will either see the old state or the new state — never a partial write.
 *
 * Note: A TOCTOU race remains where two processes read the same state
 * before either writes. This is accepted for telemetry counters —
 * worst case is a slightly delayed flush or a harmless double-flush.
 */
function writeFlushState(projectRoot: string, state: FlushState): void {
  const filePath = join(projectRoot, FLUSH_STATE_FILE);
  const tmpPath = filePath + '.tmp';
  const dir = dirname(filePath);
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(tmpPath, JSON.stringify(state), 'utf-8');
    renameSync(tmpPath, filePath);
  } catch {
    // Non-critical — will retry next hook
  }
}

/**
 * Determine whether a flush should be attempted based on pending count, time elapsed, and backoff.
 */
function shouldFlush(state: FlushState, batchSize: number, flushIntervalMs: number): boolean {
  // Disabled after too many consecutive failures
  if (state.consecutiveFailures >= DEFAULTS.maxConsecutiveFailures) {
    return false;
  }

  // Respect backoff window
  if (state.backoffUntil && Date.now() < new Date(state.backoffUntil).getTime()) {
    return false;
  }

  // Flush if enough events buffered
  if (state.pendingCount >= batchSize) {
    return true;
  }

  // Flush if enough time has passed since last flush
  const elapsed = Date.now() - new Date(state.lastFlushAt).getTime();
  if (state.pendingCount > 0 && elapsed >= flushIntervalMs) {
    return true;
  }

  return false;
}

/**
 * Calculate next backoff timestamp based on consecutive failure count.
 */
function getBackoffUntil(failures: number): string {
  const index = Math.min(failures - 1, BACKOFF_SCHEDULE.length - 1);
  const delayMs = BACKOFF_SCHEDULE[Math.max(0, index)];
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Called on every hook invocation when autoSync is enabled.
 * Increments pending counter, then flushes if thresholds are met.
 * Entire operation is fail-open — errors never propagate.
 */
export async function maybeFlushToCloud(
  projectRoot: string,
  apiKey: string,
  cloudConfig: CloudConfig,
): Promise<void> {
  try {
    const streaming = cloudConfig.streaming ?? {};
    const batchSize = streaming.batchSize ?? DEFAULTS.batchSize;
    const flushIntervalMs = streaming.flushIntervalMs ?? DEFAULTS.flushIntervalMs;
    const timeoutMs = streaming.timeoutMs ?? DEFAULTS.timeoutMs;

    // Increment pending count (synchronous, fast)
    const state = readFlushState(projectRoot);
    state.pendingCount += 1;

    if (!shouldFlush(state, batchSize, flushIntervalMs)) {
      writeFlushState(projectRoot, state);
      return;
    }

    // Read unsynced records
    const allRecords = readRuleHits(projectRoot);
    const cursor = readSyncCursor(projectRoot);
    let unsyncedRecords = getUnsyncedRecords(allRecords, cursor);

    if (unsyncedRecords.length === 0) {
      state.pendingCount = 0;
      state.lastFlushAt = new Date().toISOString();
      writeFlushState(projectRoot, state);
      return;
    }

    // Apply path exclusions (.vguardignore + cloud.excludePaths)
    unsyncedRecords = applyExclusions(unsyncedRecords, projectRoot, cloudConfig.excludePaths ?? []);

    // Limit batch size to avoid large payloads during streaming
    const maxStreamBatch = Math.min(unsyncedRecords.length, 50);
    const batch = unsyncedRecords.slice(0, maxStreamBatch);

    // Send with a tight timeout — using raw fetch to avoid CloudClient's
    // synchronous credential read and to add the stream mode header
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = batch.map((r) => JSON.stringify(r)).join('\n');
      const url =
        (process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev').replace(/\/$/, '') +
        '/api/v1/ingest';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-API-Key': apiKey,
          'X-Stream-Mode': 'true',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        // Advance sync cursor
        const lastRecord = batch[batch.length - 1];
        writeSyncCursor(projectRoot, {
          lastSyncedAt: lastRecord.timestamp,
          lastBatchSize: batch.length,
        });

        // Reset flush state
        state.pendingCount = 0;
        state.lastFlushAt = new Date().toISOString();
        state.consecutiveFailures = 0;
        state.backoffUntil = null;
        writeFlushState(projectRoot, state);
      } else {
        // Server error — count as failure
        state.consecutiveFailures += 1;
        if (state.consecutiveFailures >= 3) {
          state.backoffUntil = getBackoffUntil(state.consecutiveFailures);
        }
        writeFlushState(projectRoot, state);
      }
    } catch {
      clearTimeout(timeout);
      // Network error or timeout — count as failure
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= 3) {
        state.backoffUntil = getBackoffUntil(state.consecutiveFailures);
      }
      writeFlushState(projectRoot, state);
    }
  } catch {
    // Outer catch — never propagate errors
  }
}
