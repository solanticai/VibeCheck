import type { Preset } from '../types.js';

export const reactNative: Preset = {
  id: 'react-native',
  name: 'React Native',
  description: 'React Native conventions: component naming, import aliases, file structure.',
  version: '1.0.0',
  rules: {
    'quality/naming-conventions': {
      componentDirs: ['/components/', '/screens/', '/navigation/'],
      hookDirs: ['/hooks/'],
    },
    'quality/import-aliases': {
      aliases: ['@/'],
    },
    'quality/file-structure': {
      framework: 'react',
    },
    'performance/bundle-size': true,
    'maintainability/max-function-params': true,
  },
};
