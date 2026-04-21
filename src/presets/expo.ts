import type { Preset } from '../types.js';

export const expo: Preset = {
  id: 'expo',
  name: 'Expo',
  description:
    'Expo conventions: SecureStore keychainAccessible, EAS Update signing, config plugin review, no experimental RSC in prod.',
  version: '1.0.0',
  rules: {
    'security/expo-no-plain-secure-store': true,
    'security/expo-eas-update-signing': true,
    'security/expo-config-plugin-review': true,
    'security/expo-no-experimental-rsc-in-prod': true,
    'security/secret-detection': true,
  },
};
