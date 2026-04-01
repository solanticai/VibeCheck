import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,
      },
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.config.*', '**/*.d.ts'],
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/benchmarks/**'],
  },
});
