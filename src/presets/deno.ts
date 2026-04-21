import type { Preset } from '../types.js';

export const deno: Preset = {
  id: 'deno',
  name: 'Deno',
  description: 'Deno conventions: no -A permissions, pin jsr/npm imports, no FFI/eval.',
  version: '1.0.0',
  rules: {
    'security/deno-permissions-audit': true,
    'security/deno-import-map-pinning': true,
    'security/deno-no-eval-ffi': true,
    'security/secret-detection': true,
  },
};
