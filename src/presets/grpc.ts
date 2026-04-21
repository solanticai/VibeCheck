import type { Preset } from '../types.js';

export const grpc: Preset = {
  id: 'grpc',
  name: 'gRPC',
  description:
    'gRPC conventions: TLS required, auth interceptors, max message size, client deadlines.',
  version: '1.0.0',
  rules: {
    'security/grpc-tls-required': true,
    'security/grpc-auth-interceptor': true,
    'security/grpc-max-message-size': true,
    'security/grpc-deadline-propagation': true,
  },
};
