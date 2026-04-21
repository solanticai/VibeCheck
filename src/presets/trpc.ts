import type { Preset } from '../types.js';

export const trpc: Preset = {
  id: 'trpc',
  name: 'tRPC',
  description:
    'tRPC conventions: .input() validation, protectedProcedure for mutations, no server-only leakage to client.',
  version: '1.0.0',
  rules: {
    'security/trpc-require-input-validation': true,
    'security/trpc-auth-middleware': true,
    'security/trpc-no-leaked-server-only': true,
    'quality/no-any-type': true,
  },
};
