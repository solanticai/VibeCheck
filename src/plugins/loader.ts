import type { VibeCheckPlugin } from '../types.js';
import { registerRule } from '../engine/registry.js';
import { registerPreset } from '../config/presets.js';
import { validatePlugin } from './validator.js';

/** Result of loading plugins */
export interface PluginLoadResult {
  loaded: string[];
  errors: Array<{ plugin: string; error: string }>;
  rulesAdded: number;
  presetsAdded: number;
}

/**
 * Load and register plugins from config.
 *
 * Plugins are npm packages that export a VibeCheckPlugin object.
 * They can provide additional rules and presets.
 */
export async function loadPlugins(pluginNames: string[]): Promise<PluginLoadResult> {
  const result: PluginLoadResult = {
    loaded: [],
    errors: [],
    rulesAdded: 0,
    presetsAdded: 0,
  };

  for (const name of pluginNames) {
    try {
      const plugin = await importPlugin(name);
      const validation = validatePlugin(plugin, name);

      if (!validation.valid) {
        result.errors.push({ plugin: name, error: validation.errors.join('; ') });
        continue;
      }

      // Register rules
      if (plugin.rules) {
        for (const rule of plugin.rules) {
          registerRule(rule);
          result.rulesAdded++;
        }
      }

      // Register presets
      if (plugin.presets) {
        for (const preset of plugin.presets) {
          registerPreset(preset);
          result.presetsAdded++;
        }
      }

      result.loaded.push(name);
    } catch (error) {
      result.errors.push({
        plugin: name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Import a plugin package dynamically.
 * Supports both default and named exports.
 */
async function importPlugin(name: string): Promise<VibeCheckPlugin> {
  // Try dynamic import first (ESM)
  try {
    const mod = await import(name);
    const plugin = mod.default ?? mod;

    if (isVibeCheckPlugin(plugin)) {
      return plugin;
    }
  } catch {
    // Fall through to require
  }

  // Try createRequire for CJS packages
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const mod = require(name);
    const plugin = mod.default ?? mod;

    if (isVibeCheckPlugin(plugin)) {
      return plugin;
    }
  } catch {
    // Fall through
  }

  throw new Error(`Could not import plugin "${name}". Is it installed?`);
}

function isVibeCheckPlugin(obj: unknown): obj is VibeCheckPlugin {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'version' in obj &&
    typeof (obj as VibeCheckPlugin).name === 'string' &&
    typeof (obj as VibeCheckPlugin).version === 'string'
  );
}
