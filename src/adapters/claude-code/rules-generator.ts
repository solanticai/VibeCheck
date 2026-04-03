import type { GeneratedFile, ResolvedConfig } from '../../types.js';
import { buildEnforcementRulesMarkdown } from './templates/rules-template.js';

/**
 * Generate .claude/rules/vguard-enforcement.md with active rule documentation.
 *
 * Uses 'overwrite' strategy because this file must stay in sync with the
 * resolved config. It is regenerated on every `vguard generate`.
 */
export function generateEnforcementRules(config: ResolvedConfig): GeneratedFile {
  const content = buildEnforcementRulesMarkdown(config);

  return {
    path: '.claude/rules/vguard-enforcement.md',
    content,
    mergeStrategy: 'overwrite',
  };
}
