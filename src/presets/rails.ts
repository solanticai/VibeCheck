import type { Preset } from '../types.js';

export const rails: Preset = {
  id: 'rails',
  name: 'Ruby on Rails',
  description:
    'Rails conventions: strong params, brakeman, CSP default-deny, encrypted PII attributes.',
  version: '1.0.0',
  rules: {
    'security/rails-mass-assignment-strong-params': true,
    'security/rails-brakeman-required': true,
    'security/rails-csp-default-deny': true,
    'security/rails-encrypted-attr-on-pii': true,
    'security/secret-detection': true,
  },
};
