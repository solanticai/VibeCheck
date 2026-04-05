import { appendFileSync, mkdirSync, readFileSync, existsSync, statSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { RuleResult, HookEvent } from '../types.js';

/** A single rule hit record */
export interface RuleHitRecord {
  timestamp: string;
  ruleId: string;
  status: 'pass' | 'block' | 'warn';
  filePath?: string;
  event: HookEvent;
  tool: string;
  /** Claude Code session identifier (forwarded from hook stdin) */
  sessionId?: string;
}

const LOG_FILENAME = '.vguard/data/rule-hits.jsonl';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Record a rule hit to the JSONL log file.
 * Append-only, async-safe (uses appendFileSync for minimal overhead).
 */
export function recordRuleHit(
  result: RuleResult,
  event: HookEvent,
  tool: string,
  filePath: string | undefined,
  projectRoot: string,
  sessionId?: string,
): void {
  try {
    const logPath = join(projectRoot, LOG_FILENAME);
    const dir = dirname(logPath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Auto-rotate if too large
    if (existsSync(logPath)) {
      const { size } = statSync(logPath);
      if (size > MAX_LOG_SIZE) {
        renameSync(logPath, logPath + '.old');
      }
    }

    const record: RuleHitRecord = {
      timestamp: new Date().toISOString(),
      ruleId: result.ruleId,
      status: result.status,
      filePath,
      event,
      tool,
      ...(sessionId !== undefined ? { sessionId } : {}),
    };

    appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Tracking should never interfere with normal operation
  }
}

/**
 * Parse JSONL content into RuleHitRecord array.
 */
function parseJsonlContent(content: string): RuleHitRecord[] {
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as RuleHitRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is RuleHitRecord => r !== null);
}

/**
 * Read all rule hit records from the log file.
 * Also reads the rotated `.old` file to prevent data loss
 * for records written between the last sync and log rotation.
 */
export function readRuleHits(projectRoot: string): RuleHitRecord[] {
  const logPath = join(projectRoot, LOG_FILENAME);
  const oldPath = logPath + '.old';
  const records: RuleHitRecord[] = [];

  try {
    // Read rotated file first (older records) to maintain chronological order
    if (existsSync(oldPath)) {
      const oldContent = readFileSync(oldPath, 'utf-8');
      records.push(...parseJsonlContent(oldContent));
    }

    // Then read current file (newer records)
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      records.push(...parseJsonlContent(content));
    }
  } catch {
    // Fail gracefully — return whatever we have
  }

  return records;
}
