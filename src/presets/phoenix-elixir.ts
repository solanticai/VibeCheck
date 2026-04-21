import type { Preset } from '../types.js';

export const phoenixElixir: Preset = {
  id: 'phoenix-elixir',
  name: 'Phoenix (Elixir)',
  description:
    'Phoenix/Elixir conventions: :sobelow, :mix_audit, LiveView CSRF, no raw SQL fragment interpolation.',
  version: '1.0.0',
  rules: {
    'security/phoenix-sobelow-required': true,
    'security/phoenix-mix-audit-required': true,
    'security/phoenix-liveview-csrf': true,
    'security/phoenix-raw-sql-fragment-scan': true,
    'security/secret-detection': true,
  },
};
