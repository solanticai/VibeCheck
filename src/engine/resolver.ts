import type { Rule, HookEvent, ResolvedConfig, ResolvedRuleConfig } from '../types.js';
import { getAllRules } from './registry.js';

/** A rule paired with its resolved configuration */
export interface ResolvedRule {
  rule: Rule;
  config: ResolvedRuleConfig;
}

/**
 * Topological sort by `runAfter`. Rules without `runAfter` keep their
 * registration-order relative position. Missing predecessors are ignored
 * silently. Cycles fall back to registration order (and emit no error —
 * fail-open).
 */
function topoSort(rules: ResolvedRule[]): ResolvedRule[] {
  const ids = new Set(rules.map((r) => r.rule.id));
  const depsById = new Map<string, Set<string>>();
  for (const r of rules) {
    const deps = new Set<string>();
    for (const d of r.rule.runAfter ?? []) {
      if (ids.has(d)) deps.add(d);
    }
    depsById.set(r.rule.id, deps);
  }

  const out: ResolvedRule[] = [];
  const placed = new Set<string>();
  const queue = [...rules];
  const MAX_PASSES = rules.length + 1;
  let pass = 0;

  while (queue.length > 0 && pass < MAX_PASSES) {
    pass++;
    const remaining: ResolvedRule[] = [];
    for (const r of queue) {
      const deps = depsById.get(r.rule.id) ?? new Set();
      const ready = [...deps].every((d) => placed.has(d));
      if (ready) {
        out.push(r);
        placed.add(r.rule.id);
      } else {
        remaining.push(r);
      }
    }
    if (remaining.length === queue.length) break; // cycle — bail
    queue.length = 0;
    queue.push(...remaining);
  }

  // Append any rules still stuck in a cycle to preserve fail-open semantics.
  for (const r of queue) {
    if (!placed.has(r.rule.id)) {
      out.push(r);
      placed.add(r.rule.id);
    }
  }

  return out;
}

/**
 * Resolve which rules should run for a given event and tool.
 *
 * Filters rules by:
 * 1. Whether the rule is enabled in config
 * 2. Whether the rule's events include the current event
 * 3. Whether the rule's tool matcher includes the current tool
 *
 * Returns rules ordered by: registration order, then topologically sorted
 * by any `runAfter` dependencies. Cycles fall back to registration order.
 */
export function resolveRules(
  event: HookEvent,
  tool: string,
  config: ResolvedConfig,
): ResolvedRule[] {
  const allRules = getAllRules();
  const resolved: ResolvedRule[] = [];

  for (const [id, rule] of allRules) {
    const ruleConfig = config.rules.get(id);
    const isEnabled = ruleConfig ? ruleConfig.enabled : id.startsWith('security/');
    if (!isEnabled) continue;

    if (!rule.events.includes(event)) continue;

    if (rule.match?.tools && rule.match.tools.length > 0) {
      const toolMatches = rule.match.tools.some((pattern) => {
        const parts = pattern.split('|').map((p) => p.trim());
        return parts.includes(tool);
      });
      if (!toolMatches) continue;
    }

    const effectiveConfig: ResolvedRuleConfig = ruleConfig ?? {
      enabled: true,
      severity: rule.severity,
      options: {},
    };

    resolved.push({ rule, config: effectiveConfig });
  }

  return topoSort(resolved);
}
