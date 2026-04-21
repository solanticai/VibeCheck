import type { Preset } from '../types.js';

export const graphql: Preset = {
  id: 'graphql',
  name: 'GraphQL',
  description:
    'GraphQL conventions: no introspection in prod, depth/complexity limits, resolver input validation.',
  version: '1.0.0',
  rules: {
    'security/graphql-no-introspection-in-prod': true,
    'security/graphql-depth-limit': true,
    'security/graphql-complexity-limit': true,
    'security/graphql-resolver-input-validation': true,
  },
};
