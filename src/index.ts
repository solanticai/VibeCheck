// ─── Public API ─────────────────────────────────────────────────────────────

// Types
export type {
  Rule,
  RuleResult,
  HookContext,
  HookEvent,
  MatchPattern,
  GitContext,
  VGuardConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  RuleConfig,
  AgentType,
  Preset,
  Adapter,
  GeneratedFile,
  VGuardPlugin,
  LearnConfig,
} from './types.js';

// Config
export { defineConfig } from './config/define.js';
export { loadConfig, resolveConfig } from './config/loader.js';

// Engine
/**
 * Factory that turns a Write-targeting `Rule` into an Edit-targeting
 * variant whose `check()` only flags patterns that are *newly introduced*
 * by the edit — pre-existing matches in `old_string` that survive into
 * `new_string` are ignored. This is how VGuard supports incremental
 * adoption without forcing a fix-everything-first pass.
 *
 * Exported for plugin authors who want the same semantics for their
 * Write rules. Returns a new `Rule` sharing the original's `id` (events
 * and tools are rewritten to target `Edit`); register the pair together.
 *
 * @see src/engine/edit-rule-factory.ts for the full implementation.
 */
export { createEditVariant } from './engine/edit-rule-factory.js';
export {
  registerRule,
  registerRules,
  getRule,
  getAllRules,
  hasRule,
  getRuleIds,
} from './engine/registry.js';

// Presets
export { registerPreset, getPreset, getAllPresets } from './config/presets.js';

// Plugins
export { loadPlugins } from './plugins/loader.js';
export { validatePlugin } from './plugins/validator.js';
