import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { DiscoveredPattern } from './analyzers/types.js';

/** A rule configuration suggested from a discovered pattern */
export interface PromotionSuggestion {
  ruleId: string;
  config: Record<string, unknown>;
  reason: string;
  confidence: number;
}

/**
 * Filter promotable patterns and generate rule configuration suggestions.
 * Only suggests patterns with confidence >= threshold.
 */
export function getPromotionSuggestions(
  patterns: DiscoveredPattern[],
  confidenceThreshold = 0.7,
): PromotionSuggestion[] {
  return patterns
    .filter((p) => p.promotable && p.suggestedRule && p.confidence >= confidenceThreshold)
    .map((p) => ({
      ruleId: p.suggestedRule!.ruleId,
      config: p.suggestedRule!.config,
      reason: p.description,
      confidence: p.confidence,
    }));
}

/**
 * Merge promotion suggestions into a VGuard config rules object.
 * Deduplicates by ruleId and merges configs.
 */
export function mergePromotions(
  suggestions: PromotionSuggestion[],
): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {};

  for (const suggestion of suggestions) {
    if (!merged[suggestion.ruleId]) {
      merged[suggestion.ruleId] = {};
    }
    Object.assign(merged[suggestion.ruleId], suggestion.config);
  }

  return merged;
}

/**
 * Generate a TypeScript rule file from a promotion suggestion.
 * Writes to .vguard/rules/custom/<ruleId>.ts
 */
export async function generateRuleFile(
  suggestion: PromotionSuggestion,
  projectRoot: string,
): Promise<string> {
  const safeName = suggestion.ruleId.replace('/', '-');
  const outputPath = join(projectRoot, '.vguard', 'rules', 'custom', `${safeName}.ts`);
  await mkdir(dirname(outputPath), { recursive: true });

  const configJson = JSON.stringify(suggestion.config, null, 2);
  const content = `import type { Rule } from '@anthril/vguard';

/**
 * Auto-generated rule from convention learning.
 * Reason: ${suggestion.reason}
 * Confidence: ${Math.round(suggestion.confidence * 100)}%
 */
export const ${toCamelCase(safeName)}: Rule = {
  id: '${suggestion.ruleId}',
  name: '${suggestion.ruleId}',
  description: '${suggestion.reason.replace(/'/g, "\\'")}',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context) => {
    // Base rule: ${suggestion.ruleId}
    // Config: ${configJson}
    // TODO: Customize this check logic for your project
    return { status: 'pass', ruleId: '${suggestion.ruleId}' };
  },
};
`;

  await writeFile(outputPath, content, 'utf-8');
  return outputPath;
}

function toCamelCase(str: string): string {
  return str.replace(/[-/](\w)/g, (_, c) => c.toUpperCase());
}
