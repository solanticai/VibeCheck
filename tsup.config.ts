import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    'hooks/runner': 'src/engine/hook-entry.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'node20',
  shims: true,
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '#!/usr/bin/env node',
      };
    }
    return {};
  },
});
