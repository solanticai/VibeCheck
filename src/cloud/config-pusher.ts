import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import type { ProjectConfigPushPayload } from '../types.js';
import { CloudClient } from './client.js';

/**
 * Throttled pusher for project config snapshots.
 *
 * Responsibilities:
 *   1. Load the resolved config snapshot and vguard version from disk
 *   2. Compute a stable hash of the snapshot
 *   3. Skip the push if the hash is unchanged AND the last push was
 *      less than 24h ago
 *   4. Otherwise POST to /functions/v1/ingest-config and persist the
 *      new (hash, timestamp) pair
 *
 * Fail-open: every error is swallowed. Config push is telemetry-
 * adjacent and must never break a developer's workflow.
 */

const STATE_FILE = '.vguard/data/config-sync-state.json';
const RESOLVED_CONFIG_FILE = '.vguard/cache/resolved-config.json';
const PACKAGE_JSON_FILE = 'package.json';
const VGUARD_PACKAGE_JSON_PATH = 'node_modules/@anthril/vguard/package.json';
const THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ConfigSyncState {
  lastPushedHash: string;
  lastPushedAt: string;
}

interface ResolvedConfigFile {
  presets?: string[];
  agents?: string[];
  profile?: string;
  rules?: Record<
    string,
    { enabled?: boolean; severity?: 'pass' | 'warn' | 'block'; options?: unknown }
  >;
  resolvedAt?: string;
  language?: string;
  framework?: string;
  cloud?: {
    enabled?: boolean;
    autoSync?: boolean;
    projectId?: string;
    excludePaths?: string[];
  };
}

/**
 * Main entry point. Reads disk state, decides whether to push, performs
 * the push, and updates state on success. Returns an object describing
 * what happened (useful for tests and the manual `vguard sync` command).
 */
export async function maybePushConfigSnapshot(
  projectRoot: string,
  apiKey: string,
): Promise<{ pushed: boolean; reason: string }> {
  try {
    const resolved = readResolvedConfig(projectRoot);
    if (!resolved) {
      return { pushed: false, reason: 'no resolved config on disk' };
    }

    const vguardVersion = readVguardVersion(projectRoot);
    if (!vguardVersion) {
      return { pushed: false, reason: 'vguard version unknown' };
    }

    const payload = buildPayload(resolved, vguardVersion);
    const hash = hashPayload(payload);
    const state = readState(projectRoot);

    if (
      state &&
      state.lastPushedHash === hash &&
      Date.now() - new Date(state.lastPushedAt).getTime() < THROTTLE_MS
    ) {
      return { pushed: false, reason: 'unchanged + within 24h window' };
    }

    const client = new CloudClient();
    await client.pushConfigSnapshot(apiKey, payload);

    writeState(projectRoot, {
      lastPushedHash: hash,
      lastPushedAt: new Date().toISOString(),
    });

    return { pushed: true, reason: 'ok' };
  } catch (err) {
    return { pushed: false, reason: err instanceof Error ? err.message : 'error' };
  }
}

/**
 * Build the wire payload from the resolved config on disk. Exported so
 * tests can exercise it without touching the filesystem.
 */
export function buildPayload(
  resolved: ResolvedConfigFile,
  vguardVersion: string,
): ProjectConfigPushPayload {
  const rules: ProjectConfigPushPayload['configSnapshot']['rules'] = {};
  for (const [ruleId, config] of Object.entries(resolved.rules ?? {})) {
    rules[ruleId] = {
      enabled: config.enabled !== false,
      severity: config.severity ?? 'warn',
      options: config.options,
    };
  }

  const payload: ProjectConfigPushPayload = {
    vguardVersion,
    configSnapshot: {
      presets: resolved.presets ?? [],
      rules,
      agents: resolved.agents ?? [],
      profile: resolved.profile,
      resolvedAt: resolved.resolvedAt ?? new Date().toISOString(),
    },
  };
  // Include the cloud config block so the dashboard can render the
  // real-time sync state ("Cloud sync: enabled" / "disabled") in the
  // resolved-config summary. Never ship an empty object — the
  // dashboard's parseConfigSnapshot keeps cloud=undefined semantics
  // equivalent to "not configured" if no fields are present.
  if (resolved.cloud && Object.keys(resolved.cloud).length > 0) {
    payload.configSnapshot.cloud = {
      enabled: resolved.cloud.enabled,
      autoSync: resolved.cloud.autoSync,
      projectId: resolved.cloud.projectId,
      excludePaths: resolved.cloud.excludePaths,
    };
  }
  if (resolved.language) payload.language = resolved.language;
  if (resolved.framework) payload.framework = resolved.framework;
  return payload;
}

/**
 * Compute a stable content hash of the outgoing payload. Only the
 * configSnapshot + version contribute — language/framework don't
 * change the dashboard render and would cause extra pushes without
 * providing new data.
 */
export function hashPayload(payload: ProjectConfigPushPayload): string {
  const stable = JSON.stringify({
    v: payload.vguardVersion,
    c: payload.configSnapshot,
  });
  return createHash('sha256').update(stable).digest('hex');
}

function readResolvedConfig(projectRoot: string): ResolvedConfigFile | null {
  try {
    const path = join(projectRoot, RESOLVED_CONFIG_FILE);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as ResolvedConfigFile;
  } catch {
    return null;
  }
}

function readVguardVersion(projectRoot: string): string | null {
  // Prefer the installed package's own version; fall back to the
  // consumer project's package.json if somehow we're running outside
  // node_modules (e.g. during development).
  for (const candidate of [VGUARD_PACKAGE_JSON_PATH, PACKAGE_JSON_FILE]) {
    try {
      const path = join(projectRoot, candidate);
      if (!existsSync(path)) continue;
      const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { version?: string };
      if (typeof pkg.version === 'string' && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // keep trying
    }
  }
  return null;
}

export function readState(projectRoot: string): ConfigSyncState | null {
  try {
    const path = join(projectRoot, STATE_FILE);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as ConfigSyncState;
  } catch {
    return null;
  }
}

export function writeState(projectRoot: string, state: ConfigSyncState): void {
  const path = join(projectRoot, STATE_FILE);
  const tmp = path + '.tmp';
  const dir = dirname(path);
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    renameSync(tmp, path);
  } catch {
    // non-critical
  }
}
