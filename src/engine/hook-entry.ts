/**
 * Hook entry point for generated hook scripts.
 * This module is imported by generated hook scripts via `require('@anthril/vguard/hooks/runner')`.
 *
 * It reads stdin, builds context, resolves rules, runs them, and outputs results.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { HookEvent, CloudConfig } from '../types.js';
import { parseStdinJson, extractToolInput, extractSessionId } from '../utils/stdin.js';
import { loadCompiledConfigWithMetadata } from '../config/compile.js';
import { buildHookContext } from './context.js';
import { resolveRules } from './resolver.js';
import { runRules } from './runner.js';
import { recordRuleHit } from './tracker.js';
import { recordSessionEvent } from './session-tracker.js';
import { recordPerfEntry } from './perf.js';
import { formatPreToolUseOutput, formatPostToolUseOutput, formatStopOutput } from './output.js';
import { isValidHookEvent } from '../utils/validation.js';
import { buildGitContext } from '../utils/git.js';
import { createIgnoreMatcher } from '../utils/ignore.js';

// Import and register all built-in rules
import '../rules/index.js';
import { loadLocalRules, loadLocalRulesFromPaths } from '../plugins/local-rule-loader.js';

/**
 * Main hook execution function.
 * Called by generated hook scripts with the event type.
 */
export async function executeHook(event: HookEvent): Promise<void> {
  try {
    // 0. Validate event at runtime
    if (!isValidHookEvent(event)) {
      process.exit(0);
    }

    // 1. Parse stdin
    const rawInput = parseStdinJson();
    if (!rawInput) {
      process.exit(0); // Fail open on missing/invalid input
    }

    // 2. Load pre-compiled config (fast path)
    const cached = await loadCompiledConfigWithMetadata(process.cwd());
    if (!cached) {
      process.exit(0); // No config = no enforcement
    }
    const config = cached.config;

    // 2b. Register project-local rules so any rule IDs the resolved
    // config references are in the registry. Prefer the replay path
    // (no filesystem scan) when `vguard generate` persisted the list;
    // fall back to the directory scan for legacy caches or when the
    // user edited local rules without re-generating. Fail-open.
    if (cached.metadata.localRulePaths && cached.metadata.localRulePaths.length > 0) {
      await loadLocalRulesFromPaths(process.cwd(), cached.metadata.localRulePaths);
    } else {
      await loadLocalRules(process.cwd());
    }

    // 3. Extract tool info + session identifier
    const { toolName } = extractToolInput(rawInput);
    const sessionId = extractSessionId(rawInput);

    // 3b. Session lifecycle events are short-circuited — no rules run,
    // we just record a session marker and (optionally) kick off a flush.
    if (event === 'SessionStart' || event === 'SessionEnd') {
      handleSessionLifecycleEvent(event, sessionId, config.cloud, config.agents);
      process.exit(0);
    }

    // 3b. Honour .vguardignore — if the file being touched matches an
    // ignore pattern, short-circuit BEFORE running rules, recording hits,
    // or doing any cloud work. This keeps shadcn edits, migrations, etc.
    // from triggering blocks/warns at edit time.
    const ignoredFilePath = (rawInput.tool_input as { file_path?: string } | undefined)?.file_path;
    if (ignoredFilePath) {
      const matcher = createIgnoreMatcher(process.cwd());
      if (matcher.isIgnored(ignoredFilePath)) {
        process.exit(0);
      }
    }

    // 4. Build context
    const context = buildHookContext(
      event,
      {
        tool_name: toolName,
        tool_input: rawInput.tool_input as Record<string, unknown>,
        ...rawInput,
      },
      config,
    );

    // 5. Resolve which rules apply
    const resolvedRules = resolveRules(event, toolName, config);
    if (resolvedRules.length === 0) {
      process.exit(0); // No matching rules
    }

    // 6. Run rules (with perf tracking)
    const hookStart = Date.now();
    const result = await runRules(resolvedRules, context);
    const hookDuration = Date.now() - hookStart;

    // 6b. Record rule hits for local analytics + cloud sync
    const filePath = (rawInput.tool_input as Record<string, unknown>)?.file_path as
      | string
      | undefined;
    for (const ruleResult of result.results) {
      recordRuleHit(ruleResult, event, toolName, filePath, process.cwd(), sessionId);
    }

    // Record perf data
    recordPerfEntry(process.cwd(), {
      event,
      tool: toolName,
      durationMs: hookDuration,
      ruleCount: resolvedRules.length,
    });

    // 7. Real-time streaming to cloud (every hook event if autoSync enabled)
    if (config.cloud?.autoSync === true) {
      triggerRealTimeStream(process.cwd(), config.cloud);
      triggerConfigPush(process.cwd());
      // Piggy-back a session-events flush on every hook — inexpensive
      // safety net in case SessionEnd never fires (e.g. Claude Code crash).
      triggerSessionEventFlush(process.cwd());
    }

    // 7b. Full flush on Stop events (catch any remaining buffered records)
    if (event === 'Stop' && config.cloud?.autoSync === true) {
      triggerCloudSync(process.cwd());
    }

    // 8. Format and output
    if (event === 'PreToolUse') {
      const output = formatPreToolUseOutput(result);
      if (output.stderr) process.stderr.write(output.stderr);
      if (output.stdout) process.stdout.write(output.stdout);
      exitAfterDrain(output.exitCode);
    } else if (event === 'PostToolUse') {
      const output = formatPostToolUseOutput(result);
      if (output.stdout) process.stdout.write(output.stdout);
      exitAfterDrain(output.exitCode);
    } else {
      const output = formatStopOutput(result);
      if (output.stderr) process.stderr.write(output.stderr);
      exitAfterDrain(output.exitCode);
    }
  } catch {
    // Fail open — never block on internal errors
    process.exit(0);
  }
}

/**
 * Exit after the stdout + stderr pipes have finished draining.
 *
 * Plain `process.exit(code)` fires synchronously and will truncate any
 * write that hasn't yet flushed to the underlying fd — not usually
 * visible on fast pipes, but on a slow / blocked terminal (Claude Code
 * inherits the parent's stdio) the tail of a long message can be cut
 * mid-line. Setting `process.exitCode` and explicitly ending both
 * streams lets Node's runtime flush on its own terms.
 */
function exitAfterDrain(code: number): void {
  // Setting `process.exitCode` communicates the intent even if a later
  // write or callback calls `process.exit(0)` by mistake.
  process.exitCode = code;
  // `process.stdout.write('', cb)` queues behind any pending writes,
  // so the callback fires once the existing buffer is handed off to
  // the kernel. For TTY stdio this is instantaneous; for piped stdio
  // it reduces (though cannot fully eliminate) the truncation window
  // that Node's docs warn about when `process.exit()` runs while the
  // pipe still has bytes queued.
  try {
    process.stdout.write('', () => {
      /* drain complete */
    });
  } catch {
    /* stdout closed */
  }
  try {
    process.stderr.write('', () => {
      /* drain complete */
    });
  } catch {
    /* stderr closed */
  }
  process.exit(code);
}

/**
 * Emit a `[vguard:hook]` diagnostic line to stderr iff `VGUARD_DEBUG=1`.
 *
 * Hook code is load-bearing and fail-open by contract, so it mustn't
 * throw or add meaningful latency. When users complain that "nothing is
 * reaching the dashboard," this paper trail is the only reliable
 * breadcrumb; without it the empty catches below look like black boxes.
 */
function debugHook(label: string, err: unknown): void {
  if (process.env.VGUARD_DEBUG !== '1') return;
  const message = err instanceof Error ? err.message : String(err);
  try {
    process.stderr.write(`[vguard:hook] ${label}: ${message}\n`);
  } catch {
    /* stderr closed — nothing sensible to do */
  }
}

/**
 * Attempt a real-time streaming flush if buffer thresholds are met.
 * Non-blocking, fire-and-forget — errors are silently ignored.
 */
function triggerRealTimeStream(projectRoot: string, cloudConfig: NonNullable<CloudConfig>): void {
  import('../cloud/streamer.js')
    .then(({ maybeFlushToCloud }) => {
      const apiKey = process.env.VGUARD_API_KEY;
      if (!apiKey) {
        return import('../cloud/credentials.js').then(({ readCredentials }) => {
          const key = readCredentials()?.apiKey;
          if (!key) return;
          return maybeFlushToCloud(projectRoot, key, cloudConfig);
        });
      }
      return maybeFlushToCloud(projectRoot, apiKey, cloudConfig);
    })
    .catch((err) => {
      // Fail open — streaming errors should never impact the developer.
      // Preserve a breadcrumb under VGUARD_DEBUG so users can diagnose
      // "why is nothing reaching the dashboard".
      debugHook('cloud stream skipped', err);
    });
}

/**
 * Push the resolved config snapshot to Cloud if it has changed since
 * the last push (or if 24h have passed). Non-blocking, fire-and-forget
 * — errors are silently ignored. The pusher has its own internal
 * throttle + state file, so it is safe to call on every hook event.
 */
function triggerConfigPush(projectRoot: string): void {
  void import('../cloud/config-pusher.js')
    .then(({ maybePushConfigSnapshot }) => {
      const envKey = process.env.VGUARD_API_KEY;
      if (envKey) {
        return maybePushConfigSnapshot(projectRoot, envKey);
      }
      return import('../cloud/credentials.js').then(({ readCredentials }) => {
        const key = readCredentials()?.apiKey;
        if (!key) return;
        return maybePushConfigSnapshot(projectRoot, key);
      });
    })
    .catch((err) => {
      // Fail open — config push errors should never impact the developer.
      debugHook('config push skipped', err);
    });
}

/**
 * Trigger cloud sync in the background if autoSync is enabled.
 * Non-blocking, fire-and-forget — errors are silently ignored.
 */
function triggerCloudSync(projectRoot: string): void {
  // Check for API key in environment or stored credentials
  import('../cloud/credentials.js')
    .then(({ readCredentials }) => {
      const apiKey = process.env.VGUARD_API_KEY ?? readCredentials()?.apiKey;
      if (!apiKey) return;

      // Fire-and-forget async sync
      return import('../cloud/sync.js').then(({ syncToCloud }) => syncToCloud(projectRoot, apiKey));
    })
    .catch(() => {
      // Fail open — cloud sync errors should never impact the developer
    });
}

/**
 * Handle a SessionStart or SessionEnd hook event.
 *
 * Records a session lifecycle marker to
 * `.vguard/data/session-events.jsonl` (with branch/cli_version/cwd
 * metadata on start) and fires a best-effort flush to the cloud
 * sessions endpoint. No rules run on lifecycle events.
 *
 * The agent is resolved from `config.agents` (set in vguard.config.ts)
 * — never hardcoded or sniffed from environment variables.
 */
function handleSessionLifecycleEvent(
  event: 'SessionStart' | 'SessionEnd',
  sessionId: string | undefined,
  cloudConfig: CloudConfig | undefined,
  agents?: import('../types.js').AgentType[],
): void {
  if (!sessionId) return; // Nothing we can correlate without a session id.

  const projectRoot = process.cwd();

  if (event === 'SessionStart') {
    const gitContext = buildGitContext(projectRoot);
    recordSessionEvent(
      {
        type: 'start',
        sessionId,
        branch: gitContext.branch ?? 'unknown',
        cliVersion: readVguardVersion(projectRoot) ?? 'unknown',
        agent: agents?.[0] ?? 'unknown',
        cwd: projectRoot,
      },
      projectRoot,
    );
  } else {
    recordSessionEvent({ type: 'end', sessionId }, projectRoot);
  }

  // Kick off a background flush if cloud sync is enabled.
  if (cloudConfig?.autoSync === true) {
    triggerSessionEventFlush(projectRoot);
  }

  // When cloud is enabled but autoSync is OFF, trigger a batch sync at session
  // end so data reaches the dashboard even without real-time streaming.
  if (event === 'SessionEnd' && cloudConfig?.enabled === true && cloudConfig?.autoSync !== true) {
    triggerSessionEventFlush(projectRoot);
    triggerCloudSync(projectRoot);
    triggerConfigPush(projectRoot);
  }
}

/**
 * Non-blocking, fire-and-forget flush of pending session lifecycle events.
 */
function triggerSessionEventFlush(projectRoot: string): void {
  void import('../cloud/credentials.js')
    .then(({ readCredentials }) => {
      const apiKey = process.env.VGUARD_API_KEY ?? readCredentials()?.apiKey;
      if (!apiKey) return;
      return import('../cloud/session-streamer.js').then(({ flushSessionEvents }) =>
        flushSessionEvents(projectRoot, apiKey),
      );
    })
    .catch(() => {
      // Fail open — session telemetry must never impact the developer.
    });
}

/**
 * Best-effort read of the installed @anthril/vguard package version,
 * falling back to the consumer project's package.json during dev.
 * Duplicated here (vs imported from config-pusher) to avoid a dependency
 * cycle and to keep hook startup fast.
 */
function readVguardVersion(projectRoot: string): string | null {
  const candidates = ['node_modules/@anthril/vguard/package.json', 'package.json'];
  for (const candidate of candidates) {
    try {
      const path = join(projectRoot, candidate);
      if (!existsSync(path)) continue;
      const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { version?: string };
      if (typeof pkg.version === 'string' && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}
