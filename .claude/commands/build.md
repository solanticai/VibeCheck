Build the VGuard project and verify output.

## Steps

1. Run TypeScript type checking:
   ```bash
   npm run type-check
   ```

2. Run the build:
   ```bash
   npm run build
   ```

3. Verify the build output in `dist/`:
   - `dist/index.js` (ESM library) and `dist/index.cjs` (CJS library)
   - `dist/cli.js` (ESM CLI) and `dist/cli.cjs` (CJS CLI with shebang)
   - `dist/hooks/runner.js` and `dist/hooks/runner.cjs` (hook runner)
   - Type declarations: `dist/index.d.ts`, `dist/cli.d.ts`

4. Run lint check:
   ```bash
   npm run lint
   ```

5. Run format check:
   ```bash
   npm run format:check
   ```

If any step fails, analyze the error and suggest fixes.

## Build System

- **tsup** generates dual ESM/CJS bundles
- 3 entry points: `src/index.ts`, `src/cli/index.ts`, `src/engine/hook-entry.ts`
- TypeScript 6.0.2 strict mode
- Target: ES2022, NodeNext module resolution
