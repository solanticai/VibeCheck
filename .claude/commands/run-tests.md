Run the VGuard test suite and analyze results.

## Steps

1. Run the full test suite:
   ```bash
   npm test
   ```

2. If tests fail:
   - Read the failure output carefully
   - Identify the failing test file and specific test case
   - Read the source file being tested to understand the expected behavior
   - Propose a fix for either the test or the source code
   - Re-run the specific failing test to verify: `npm test -- tests/<path>.test.ts`

3. Run with coverage to check thresholds:
   ```bash
   npm run test:coverage
   ```
   Coverage threshold is 80% line coverage.

4. For specific test files:
   ```bash
   npm test -- --reporter verbose tests/rules/security/branch-protection.test.ts
   ```

## Test Structure

Tests mirror the `src/` directory:
- `tests/rules/{security,quality,workflow}/` — rule tests
- `tests/engine/` — engine tests
- `tests/config/` — config tests
- `tests/adapters/` — adapter tests
- `tests/cli/` — CLI command tests
- `tests/integration/` — end-to-end tests
