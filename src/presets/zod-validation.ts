import type { Preset } from '../types.js';

export const zodValidation: Preset = {
  id: 'zod-validation',
  name: 'Zod Validation',
  description:
    'Cross-cutting validation preset: server action schemas, no z.any, explicit strict/strip on objects.',
  version: '1.0.0',
  rules: {
    'security/zod-server-action-input': true,
    'quality/zod-no-any-schema': true,
    'quality/zod-require-strip-or-strict': true,
  },
};
