import type { VibeCheckPlugin } from '../types.js';
import { hasRule } from '../engine/registry.js';
import { hasPreset } from '../config/presets.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a plugin before registration.
 *
 * Checks:
 * - Plugin has required name and version fields
 * - Rule IDs don't conflict with built-in rules
 * - Rule IDs follow naming convention (category/name)
 * - Preset IDs don't conflict with built-in presets
 */
export function validatePlugin(plugin: VibeCheckPlugin, packageName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic shape validation
  if (!plugin.name || typeof plugin.name !== 'string') {
    errors.push('Plugin must have a "name" string field');
  }
  if (!plugin.version || typeof plugin.version !== 'string') {
    errors.push('Plugin must have a "version" string field');
  }

  if (!plugin.rules?.length && !plugin.presets?.length) {
    warnings.push(`Plugin "${packageName}" has no rules or presets`);
  }

  // Validate rules
  if (plugin.rules) {
    for (const rule of plugin.rules) {
      if (!rule.id) {
        errors.push('Each rule must have an "id" field');
        continue;
      }

      // Check ID format
      if (!rule.id.includes('/')) {
        errors.push(`Rule "${rule.id}" must follow category/name format (e.g., "custom/my-rule")`);
      }

      // Check for conflicts with built-in rules
      if (hasRule(rule.id)) {
        errors.push(`Rule "${rule.id}" conflicts with a built-in rule. Use a unique prefix (e.g., "plugin-name/${rule.id.split('/').pop()}")`);
      }

      // Check required fields
      if (!rule.name) errors.push(`Rule "${rule.id}" is missing "name" field`);
      if (!rule.check || typeof rule.check !== 'function') {
        errors.push(`Rule "${rule.id}" is missing "check" function`);
      }
      if (!rule.events?.length) {
        errors.push(`Rule "${rule.id}" must specify at least one event`);
      }
    }
  }

  // Validate presets
  if (plugin.presets) {
    for (const preset of plugin.presets) {
      if (!preset.id) {
        errors.push('Each preset must have an "id" field');
        continue;
      }

      if (hasPreset(preset.id)) {
        errors.push(`Preset "${preset.id}" conflicts with a built-in preset`);
      }

      if (!preset.rules || Object.keys(preset.rules).length === 0) {
        warnings.push(`Preset "${preset.id}" has no rules configured`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
