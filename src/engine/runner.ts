import type { RuleResult, HookContext, EnforcementMode } from '../types.js';
import type { ResolvedRule } from './resolver.js';

/** Aggregated result from running all resolved rules */
export interface RunResult {
  /** Whether any rule blocked the operation */
  blocked: boolean;
  /** All results from all rules */
  results: RuleResult[];
  /** The first blocking result (if any) */
  blockingResult: RuleResult | null;
  /** All warning results */
  warnings: RuleResult[];
}

/**
 * Decide what to emit when a rule's `check()` throws, given the configured
 * enforcement mode and the rule's declared severity.
 *
 *   fail-open   → always warn (historical behavior)
 *   fail-closed → always block
 *   hybrid      → block if the rule is block-severity, else warn
 */
function synthesiseErrorResult(
  ruleId: string,
  error: unknown,
  ruleSeverity: 'block' | 'warn' | 'info',
  mode: EnforcementMode,
): RuleResult {
  const errMsg = error instanceof Error ? error.message : String(error);
  const message = `Rule "${ruleId}" threw an internal error: ${errMsg}`;

  const shouldBlock = mode === 'fail-closed' || (mode === 'hybrid' && ruleSeverity === 'block');

  if (shouldBlock) {
    return {
      status: 'block',
      ruleId,
      message,
      fix:
        'This is an internal VGuard rule error (not your code). ' +
        'Set enforcement: "fail-open" in vguard.config.ts to avoid blocking on rule crashes, ' +
        'or report the crash at https://github.com/anthril/vibe-guard/issues.',
      metadata: { enforcementMode: mode, ruleSeverity, internal: true },
    };
  }

  return {
    status: 'warn',
    ruleId,
    message,
    metadata: { enforcementMode: mode, ruleSeverity, internal: true },
  };
}

/**
 * Run resolved rules sequentially against a hook context.
 *
 * For PreToolUse events: short-circuits on the first blocking result.
 * For PostToolUse/Stop events: runs all rules and collects warnings.
 *
 * Internal errors in a rule's check() are mapped to block/warn according to
 * `context.projectConfig.enforcement` (default: 'hybrid').
 */
export async function runRules(
  resolvedRules: ResolvedRule[],
  context: HookContext,
): Promise<RunResult> {
  const results: RuleResult[] = [];
  let blockingResult: RuleResult | null = null;
  const warnings: RuleResult[] = [];
  const isPreToolUse = context.event === 'PreToolUse';
  const enforcement: EnforcementMode = context.projectConfig.enforcement ?? 'hybrid';

  // Track per-rule status so `required: true` can skip rules whose deps blocked.
  const statusById = new Map<string, 'pass' | 'warn' | 'block' | 'skipped'>();

  for (const { rule, config } of resolvedRules) {
    // If this rule declares dependencies and is `required`, skip when any
    // dependency blocked (or was itself skipped due to upstream block).
    if (rule.required && rule.runAfter && rule.runAfter.length > 0) {
      const upstreamBlocked = rule.runAfter.some((depId) => {
        const s = statusById.get(depId);
        return s === 'block' || s === 'skipped';
      });
      if (upstreamBlocked) {
        statusById.set(rule.id, 'skipped');
        continue;
      }
    }

    try {
      // Build context with rule-specific config options
      const ruleContext: HookContext = {
        ...context,
        projectConfig: {
          ...context.projectConfig,
          rules: new Map(context.projectConfig.rules),
        },
      };

      // Add rule options to the context for rule-specific configuration
      if (config.options && Object.keys(config.options).length > 0) {
        ruleContext.projectConfig.rules.set(rule.id, config);
      }

      const result = await rule.check(ruleContext);

      // Apply severity override from config — downgrade only, never upgrade
      if (result.status !== 'pass') {
        const severityRank = { info: 0, warn: 1, block: 2 };
        const configRank = severityRank[config.severity];
        const resultRank = severityRank[result.status];
        if (configRank < resultRank) {
          result.status = config.severity === 'info' ? 'warn' : config.severity;
        }
      }

      results.push(result);
      statusById.set(rule.id, result.status === 'pass' ? 'pass' : result.status);

      if (result.status === 'block') {
        blockingResult = blockingResult ?? result;
        // Short-circuit on PreToolUse — we can stop early
        if (isPreToolUse) break;
      } else if (result.status === 'warn') {
        warnings.push(result);
      }
    } catch (error) {
      const errorResult = synthesiseErrorResult(rule.id, error, config.severity, enforcement);
      results.push(errorResult);
      statusById.set(rule.id, errorResult.status === 'block' ? 'block' : 'warn');
      if (errorResult.status === 'block') {
        blockingResult = blockingResult ?? errorResult;
        if (isPreToolUse) break;
      } else {
        warnings.push(errorResult);
      }
    }
  }

  return {
    blocked: blockingResult !== null,
    results,
    blockingResult,
    warnings,
  };
}
