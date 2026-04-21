import type {
  VGuardConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  RuleConfig,
  Preset,
} from '../types.js';
import { vibeCheckConfigSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { discoverConfigFile, readRawConfig } from './discovery.js';
import { getProfileSeverity, type ProfileName } from './profiles.js';

/**
 * Load and resolve the VGuard config from a project root.
 * Applies global config inheritance: global → project.
 * Returns null if no config file is found.
 */
export async function loadConfig(projectRoot: string): Promise<ResolvedConfig | null> {
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) return null;

  const raw = await readRawConfig(discovered);
  const projectConfig = raw as VGuardConfig;

  // Load global config (~/.vguard/config.ts) if it exists
  const globalConfig = await loadGlobalConfig();

  // Merge: global → project (project wins)
  const merged = globalConfig ? mergeConfigs(globalConfig, projectConfig) : projectConfig;

  return resolveConfig(merged);
}

/**
 * Load the global user config from ~/.vguard/config.ts.
 * Returns null if no global config exists.
 */
async function loadGlobalConfig(): Promise<VGuardConfig | null> {
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const globalRoot = join(homedir(), '.vguard');
  const discovered = discoverConfigFile(globalRoot);
  if (!discovered) return null;

  try {
    const raw = await readRawConfig(discovered);
    return raw as VGuardConfig;
  } catch {
    return null;
  }
}

/**
 * Merge two configs: base → override.
 * Override values take precedence. Rules are merged per-key.
 */
function mergeConfigs(base: VGuardConfig, override: VGuardConfig): VGuardConfig {
  return {
    profile: override.profile ?? base.profile,
    presets: override.presets ?? base.presets,
    agents: override.agents ?? base.agents,
    rules: { ...base.rules, ...override.rules },
    plugins: override.plugins ?? base.plugins,
    learn: override.learn ?? base.learn,
    cloud: override.cloud ?? base.cloud,
    monorepo: override.monorepo ?? base.monorepo,
    enforcement: override.enforcement ?? base.enforcement,
  };
}

/**
 * Resolve a user config into a fully merged ResolvedConfig.
 * Merges: defaults → presets (in order) → user rules
 */
export function resolveConfig(
  userConfig: VGuardConfig,
  presetMap?: Map<string, Preset>,
): ResolvedConfig {
  // Validate config shape
  const parseResult = vibeCheckConfigSchema.safeParse(userConfig);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid VGuard config:\n${errors.join('\n')}`);
  }

  const config = parseResult.data;
  const rules = new Map<string, ResolvedRuleConfig>();

  // 1. Apply presets in order (first declared = lowest priority)
  const presetNames = config.presets ?? DEFAULT_CONFIG.presets;
  const unknownPresets: string[] = [];
  for (const presetName of presetNames) {
    const preset = presetMap?.get(presetName);
    if (!preset) {
      unknownPresets.push(presetName);
      continue;
    }

    for (const [ruleId, ruleConfig] of Object.entries(preset.rules)) {
      const resolved = normalizeRuleConfig(ruleConfig);
      rules.set(ruleId, resolved);
    }
  }

  if (unknownPresets.length > 0) {
    throw new Error(
      `Unknown preset${unknownPresets.length > 1 ? 's' : ''}: ${unknownPresets.join(', ')}. ` +
        `Available presets: ${presetMap ? Array.from(presetMap.keys()).join(', ') : 'none registered'}`,
    );
  }

  // 2. Apply user rules (highest priority — overrides presets)
  const userRules = config.rules ?? DEFAULT_CONFIG.rules;
  for (const [ruleId, ruleConfig] of Object.entries(userRules)) {
    if (ruleConfig === false) {
      // Explicitly disabled
      rules.set(ruleId, { enabled: false, severity: 'info', options: {} });
      continue;
    }

    const existing = rules.get(ruleId);
    const resolved = normalizeRuleConfig(ruleConfig);

    if (existing) {
      // Merge: user options override preset options
      rules.set(ruleId, {
        enabled: resolved.enabled,
        severity: resolved.severity || existing.severity,
        options: { ...existing.options, ...resolved.options },
      });
    } else {
      rules.set(ruleId, resolved);
    }
  }

  // 3. Apply profile severity overrides (after presets + user rules)
  const profile = config.profile as ProfileName | undefined;
  if (profile) {
    for (const [ruleId, ruleConfig] of rules) {
      // Only override if the user didn't explicitly set severity for this rule
      const userExplicitlySeverity =
        userRules[ruleId] &&
        typeof userRules[ruleId] === 'object' &&
        'severity' in (userRules[ruleId] as RuleConfig);

      if (!userExplicitlySeverity) {
        ruleConfig.severity = getProfileSeverity(profile, ruleId);
      }
    }
  }

  return {
    presets: presetNames,
    agents: config.agents ?? DEFAULT_CONFIG.agents,
    rules,
    cloud: config.cloud,
    enforcement: config.enforcement ?? 'hybrid',
  };
}

/**
 * Normalize a rule config (boolean or object) into a ResolvedRuleConfig.
 */
function normalizeRuleConfig(config: RuleConfig | boolean): ResolvedRuleConfig {
  if (typeof config === 'boolean') {
    return {
      enabled: config,
      severity: 'block',
      options: {},
    };
  }

  const { severity, ...options } = config;
  return {
    enabled: true,
    severity: severity ?? 'block',
    options,
  };
}
