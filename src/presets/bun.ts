import type { Preset } from '../types.js';

export const bun: Preset = {
  id: 'bun',
  name: 'Bun',
  description:
    'Bun runtime conventions: lockfile integrity, Bun.spawn/$ injection checks, no --trust installs.',
  version: '1.0.0',
  rules: {
    'security/bun-lockfile-integrity': true,
    'security/bun-shell-exec-scan': true,
    'security/bun-no-unverified-install': true,
    'security/secret-detection': true,
    'security/destructive-commands': true,
    'security/curl-pipe-shell': true,
    'quality/no-any-type': true,
  },
};
