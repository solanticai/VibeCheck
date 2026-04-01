// ─── Public API ─────────────────────────────────────────────────────────────

// Types
export type {
  Rule,
  RuleResult,
  HookContext,
  HookEvent,
  MatchPattern,
  GitContext,
  VibeCheckConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  RuleConfig,
  AgentType,
  Preset,
  Adapter,
  GeneratedFile,
  VibeCheckPlugin,
  LearnConfig,
} from './types.js';

// Config
export { defineConfig } from './config/define.js';
export { loadConfig, resolveConfig } from './config/loader.js';

// Engine
export { createEditVariant } from './engine/edit-rule-factory.js';
export { registerRule, registerRules, getRule, getAllRules } from './engine/registry.js';

// Presets
export { registerPreset, getPreset, getAllPresets } from './config/presets.js';

// Plugins
export { loadPlugins } from './plugins/loader.js';
export { validatePlugin } from './plugins/validator.js';
