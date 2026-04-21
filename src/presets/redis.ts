import type { Preset } from '../types.js';

export const redis: Preset = {
  id: 'redis',
  name: 'Redis',
  description: 'Redis conventions: authenticated client, no EVAL with user input, no KEYS *.',
  version: '1.0.0',
  rules: {
    'security/redis-no-unauthenticated-client': true,
    'security/redis-no-eval-user-input': true,
    'security/redis-no-keys-star-in-prod': true,
    'security/secret-detection': true,
  },
};
