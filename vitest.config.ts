import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Force file-backend credential storage in tests so they are
    // deterministic regardless of whether the developer's OS keyring
    // has real vguard credentials. Individual keyring-specific tests
    // opt into the keyring by overriding this locally.
    env: {
      VGUARD_CREDENTIAL_STORE: 'file',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 75,
        statements: 80,
      },
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.config.*', '**/*.d.ts'],
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/benchmarks/**'],
  },
});
