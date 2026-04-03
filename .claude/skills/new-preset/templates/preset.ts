import type { Preset } from '../types.js';

/**
 * {{PRESET_NAME}} preset.
 *
 * {{DESCRIPTION}}
 */
export const {{PRESET_VAR_NAME}}: Preset = {
  id: '{{PRESET_ID}}',
  name: '{{PRESET_NAME}}',
  description: '{{DESCRIPTION}}',
  version: '1.0.0',
  rules: {
    // Enable rules relevant to this tech stack.
    // Use `true` to enable with defaults, or an object to configure options.
    //
    // Examples:
    // 'quality/import-aliases': { aliases: ['@/'] },
    // 'quality/no-console-log': true,
    // 'security/env-exposure': true,
    // 'quality/file-structure': true,
  },
};
