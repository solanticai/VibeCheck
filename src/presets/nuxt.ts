import type { Preset } from '../types.js';

export const nuxt: Preset = {
  id: 'nuxt',
  name: 'Nuxt',
  description:
    'Nuxt conventions: NUXT_PUBLIC_ prefix enforcement, security headers, per-request state.',
  version: '1.0.0',
  rules: {
    'security/nuxt-env-var-prefix': true,
    'security/nuxt-security-headers': true,
    'quality/nuxt-usestate-per-request': true,
    'security/secret-detection': true,
    'quality/import-aliases': true,
  },
};
