import type { Preset } from '../types.js';

export const mongodb: Preset = {
  id: 'mongodb',
  name: 'MongoDB',
  description:
    'MongoDB conventions: no operator injection, no $where, strict schema validation, bounded projection.',
  version: '1.0.0',
  rules: {
    'security/mongo-no-operator-injection': true,
    'security/mongo-no-dollar-where': true,
    'security/mongo-strict-schema-validation': true,
    'security/mongo-no-unbound-projection': true,
    'security/secret-detection': true,
  },
};
