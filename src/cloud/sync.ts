import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { readRuleHits, type RuleHitRecord } from '../engine/tracker.js';
import { CloudClient } from './client.js';
import { createIgnoreMatcher } from '../utils/ignore.js';

const CURSOR_FILE = '.vguard/data/sync-cursor.json';

interface SyncCursor {
  /** ISO timestamp of the last synced record */
  lastSyncedAt: string;
  /** Number of records synced in last batch */
  lastBatchSize: number;
}

/**
 * Read the sync cursor to determine where to resume syncing.
 */
export function readSyncCursor(projectRoot: string): SyncCursor | null {
  const cursorPath = join(projectRoot, CURSOR_FILE);
  try {
    if (!existsSync(cursorPath)) return null;
    return JSON.parse(readFileSync(cursorPath, 'utf-8')) as SyncCursor;
  } catch {
    return null;
  }
}

/**
 * Write the sync cursor after a successful sync.
 */
export function writeSyncCursor(projectRoot: string, cursor: SyncCursor): void {
  const cursorPath = join(projectRoot, CURSOR_FILE);
  const dir = dirname(cursorPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(cursorPath, JSON.stringify(cursor, null, 2), 'utf-8');
}

/**
 * Filter records to those newer than the cursor.
 */
export function getUnsyncedRecords(
  records: RuleHitRecord[],
  cursor: SyncCursor | null,
): RuleHitRecord[] {
  if (!cursor) return records;

  const cutoff = new Date(cursor.lastSyncedAt).getTime();
  return records.filter((r) => new Date(r.timestamp).getTime() > cutoff);
}

/**
 * Common secret patterns scrubbed from every uploaded record. Matches are
 * replaced with `[redacted]`. This is defence-in-depth — rules should not
 * include secrets in their `message` / `metadata`, but a single leaked
 * secret defeats the point of running a guardrail, so we scrub regardless.
 *
 * Each pattern targets a high-signal shape so the false-positive rate is
 * negligible on typical rule messages:
 *   - `sk-` / `sk-ant-` — OpenAI / Anthropic API keys
 *   - `xoxb-` / `xoxa-` / `xoxp-` etc — Slack tokens
 *   - `gh[opusr]_` — GitHub personal / OAuth / user / server / refresh tokens
 *   - `AKIA…` — AWS access key IDs
 *   - `eyJ…\.eyJ…\.…` — JWT header.payload.sig
 *   - `AIza…` — Google API keys
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /sk(?:-ant)?-[A-Za-z0-9_-]{16,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /gh[opusr]_[A-Za-z0-9]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /AIza[0-9A-Za-z_-]{35}/g,
];

/**
 * Replace known secret shapes in a string with `[redacted]`.
 */
function scrubSecretsInString(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}

/**
 * Recursively scrub secret patterns from every string leaf in `value`.
 * Preserves structure for objects and arrays, returns non-string primitives
 * unchanged. Future-proofs the pipeline: if the record schema grows a
 * `message` or `metadata` field later, the scrubber already covers it.
 */
function scrubSecretsDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return scrubSecretsInString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSecretsDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = scrubSecretsDeep(v);
    }
    return result as T;
  }
  return value;
}

/**
 * Replace every occurrence of `needle` (and its basename) in `haystack`
 * with `[redacted]`. Empty needles are skipped to avoid pathological
 * global substitution.
 */
function scrubPathInString(haystack: string, needle: string): string {
  if (!needle) return haystack;
  let out = haystack.split(needle).join('[redacted]');
  const base = basename(needle);
  if (base && base !== needle) {
    out = out.split(base).join('[redacted]');
  }
  return out;
}

/**
 * Recursively replace `needle` + its basename in every string leaf of `value`.
 */
function scrubPathDeep<T>(value: T, needle: string): T {
  if (typeof value === 'string') {
    return scrubPathInString(value, needle) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubPathDeep(item, needle)) as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = scrubPathDeep(v, needle);
    }
    return result as T;
  }
  return value;
}

/**
 * Redact records whose `filePath` matches `.vguardignore` or the
 * `cloud.excludePaths` config (merged via IgnoreMatcher extras).
 *
 * A match causes:
 *   1. `filePath` is set to `undefined`;
 *   2. Every other string field on the record (recursively, including
 *      future-added `message` / `metadata` / etc.) is scrubbed to replace
 *      any occurrence of the excluded path or its basename with
 *      `[redacted]`.
 *
 * Records that do not match an exclusion still run through a secret
 * scrubber (`scrubSecretsDeep`) so high-signal token shapes never ship
 * to the cloud regardless of configuration.
 *
 * `projectRoot` is required so paths can be normalised relative to it
 * and so `.vguardignore` is honoured the same way it is everywhere else.
 */
export function applyExclusions(
  records: RuleHitRecord[],
  projectRoot: string,
  excludePaths: readonly string[] = [],
): RuleHitRecord[] {
  const defaultMatcher = createIgnoreMatcher(projectRoot);
  const hasMatcher = excludePaths.length > 0 || defaultMatcher.hasFile;

  const matcher = hasMatcher ? createIgnoreMatcher(projectRoot, excludePaths) : null;

  return records.map((record) => {
    let out: RuleHitRecord = record;

    if (matcher && record.filePath && matcher.isIgnored(record.filePath)) {
      out = scrubPathDeep({ ...record, filePath: undefined }, record.filePath);
    }

    return scrubSecretsDeep(out);
  });
}

export interface SyncResult {
  synced: number;
  skipped: number;
  error?: string;
}

/**
 * Sync rule hits to Cloud.
 * Non-blocking, fail-open — returns error message instead of throwing.
 */
export async function syncToCloud(
  projectRoot: string,
  apiKey: string,
  options: {
    apiUrl?: string;
    excludePaths?: string[];
    force?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<SyncResult> {
  try {
    const allRecords = readRuleHits(projectRoot);
    if (allRecords.length === 0) {
      return { synced: 0, skipped: 0 };
    }

    const cursor = options.force ? null : readSyncCursor(projectRoot);
    let unsyncedRecords = getUnsyncedRecords(allRecords, cursor);

    if (unsyncedRecords.length === 0) {
      return { synced: 0, skipped: 0 };
    }

    // Apply path exclusions (matches both .vguardignore + cloud.excludePaths)
    unsyncedRecords = applyExclusions(unsyncedRecords, projectRoot, options.excludePaths ?? []);

    if (options.dryRun) {
      return { synced: 0, skipped: unsyncedRecords.length };
    }

    // Upload in batches of 1000
    const BATCH_SIZE = 1000;
    let totalSynced = 0;

    const client = new CloudClient({ apiUrl: options.apiUrl });

    for (let i = 0; i < unsyncedRecords.length; i += BATCH_SIZE) {
      const batch = unsyncedRecords.slice(i, i + BATCH_SIZE);
      const result = await client.ingest(apiKey, batch);
      totalSynced += result.ingested;
    }

    // Advance cursor
    const lastRecord = unsyncedRecords[unsyncedRecords.length - 1];
    writeSyncCursor(projectRoot, {
      lastSyncedAt: lastRecord.timestamp,
      lastBatchSize: totalSynced,
    });

    return { synced: totalSynced, skipped: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    return { synced: 0, skipped: 0, error: message };
  }
}
