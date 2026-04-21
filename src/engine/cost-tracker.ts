import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface UsageRecord {
  /** ISO timestamp of the record. */
  timestamp: string;
  /** Claude Code session identifier if available. */
  sessionId?: string;
  /** Model name reported by the agent (e.g. "claude-opus-4-5"). */
  model?: string;
  /** Input tokens consumed. */
  inputTokens: number;
  /** Output tokens produced. */
  outputTokens: number;
  /** Derived USD cost (if pricing was resolvable). Undefined = unknown. */
  usd?: number;
}

export interface ModelPricing {
  /** USD per 1M input tokens. */
  inputPer1M: number;
  /** USD per 1M output tokens. */
  outputPer1M: number;
}

export interface CostSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalUsd: number;
  records: number;
}

const COST_LOG = '.vguard/data/cost-usage.jsonl';
const MAX_LOG_SIZE = 10 * 1024 * 1024;

function costLogPath(projectRoot: string): string {
  return join(projectRoot, COST_LOG);
}

function rotateIfLarge(path: string): void {
  try {
    if (!existsSync(path)) return;
    if (statSync(path).size > MAX_LOG_SIZE) {
      renameSync(path, path + '.old');
    }
  } catch {
    // Non-fatal
  }
}

function computeUsd(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing | undefined,
): number | undefined {
  if (!pricing) return undefined;
  return (
    (inputTokens * pricing.inputPer1M) / 1_000_000 +
    (outputTokens * pricing.outputPer1M) / 1_000_000
  );
}

/**
 * Append a usage record to .vguard/data/cost-usage.jsonl.
 * Fails silently — cost tracking must never interfere with normal operation.
 */
export function recordUsage(
  projectRoot: string,
  input: {
    inputTokens: number;
    outputTokens: number;
    model?: string;
    sessionId?: string;
    modelPricing?: Record<string, ModelPricing>;
  },
): UsageRecord | null {
  try {
    const pricing = input.model ? input.modelPricing?.[input.model] : undefined;
    const record: UsageRecord = {
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId,
      model: input.model,
      inputTokens: Math.max(0, Math.floor(input.inputTokens)),
      outputTokens: Math.max(0, Math.floor(input.outputTokens)),
      usd: computeUsd(input.inputTokens, input.outputTokens, pricing),
    };
    const path = costLogPath(projectRoot);
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    rotateIfLarge(path);
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
    return record;
  } catch {
    return null;
  }
}

function parseJsonl(content: string): UsageRecord[] {
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as UsageRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is UsageRecord => r !== null);
}

/**
 * Read usage records, optionally filtered by session or window.
 */
export function readUsage(
  projectRoot: string,
  filter?: { sessionId?: string; sinceIso?: string },
): UsageRecord[] {
  const path = costLogPath(projectRoot);
  const records: UsageRecord[] = [];
  try {
    if (existsSync(path + '.old')) {
      records.push(...parseJsonl(readFileSync(path + '.old', 'utf-8')));
    }
    if (existsSync(path)) {
      records.push(...parseJsonl(readFileSync(path, 'utf-8')));
    }
  } catch {
    return [];
  }

  let out = records;
  if (filter?.sessionId) {
    out = out.filter((r) => r.sessionId === filter.sessionId);
  }
  if (filter?.sinceIso) {
    const cutoff = Date.parse(filter.sinceIso);
    if (!Number.isNaN(cutoff)) {
      out = out.filter((r) => Date.parse(r.timestamp) > cutoff);
    }
  }
  return out;
}

/**
 * Summarise usage to token + USD totals.
 */
export function summariseUsage(records: UsageRecord[]): CostSummary {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalUsd = 0;
  for (const r of records) {
    totalInputTokens += r.inputTokens;
    totalOutputTokens += r.outputTokens;
    if (typeof r.usd === 'number') totalUsd += r.usd;
  }
  return {
    totalInputTokens,
    totalOutputTokens,
    totalUsd,
    records: records.length,
  };
}

/** Per-session totals for the current session. */
export function currentSessionSpend(
  projectRoot: string,
  sessionId: string | undefined,
): CostSummary {
  if (!sessionId) return { totalInputTokens: 0, totalOutputTokens: 0, totalUsd: 0, records: 0 };
  return summariseUsage(readUsage(projectRoot, { sessionId }));
}

/** Rolling window (e.g. last 24h) totals. */
export function rollingWindowSpend(projectRoot: string, windowMs: number): CostSummary {
  const sinceIso = new Date(Date.now() - windowMs).toISOString();
  return summariseUsage(readUsage(projectRoot, { sinceIso }));
}
