import type { VGuardConfig } from '../types.js';

/**
 * Typed helper for vguard.config.ts files.
 * Provides IDE autocomplete and type checking.
 *
 * @example
 * ```typescript
 * // vguard.config.ts
 * import { defineConfig } from '@anthril/vguard';
 *
 * export default defineConfig({
 *   presets: ['nextjs-15', 'tailwind'],
 *   agents: ['claude-code'],
 * });
 * ```
 */
export function defineConfig(config: VGuardConfig): VGuardConfig {
  return config;
}
