import type { GeneratedFile, ResolvedConfig } from '../../types.js';
import { synthesisePolicyPrompt } from '../../engine/prompt-synth.js';

/**
 * Generate .claude/rules/vguard-enforcement.md using the agent-agnostic
 * policy-as-prompt synthesizer. The file is regenerated on every
 * `vguard generate` so it always reflects the resolved config.
 */
export function generateEnforcementRules(config: ResolvedConfig): GeneratedFile {
  const content = synthesisePolicyPrompt(config, { agent: 'claude-code' });

  return {
    path: '.claude/rules/vguard-enforcement.md',
    content,
    mergeStrategy: 'overwrite',
  };
}
