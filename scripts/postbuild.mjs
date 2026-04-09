/**
 * Post-build script for @solanticai/vguard.
 *
 * Runs after tsup to:
 *   1. Inject a shebang into dist/cli.cjs (if missing)
 *   2. Generate type declarations via tsc --emitDeclarationOnly
 *   3. Generate dist/hooks/runner.d.ts from the actual source export
 *
 * Extracted from the inline `node -e` calls that were previously in
 * the package.json build script for maintainability.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CLI_CJS = 'dist/cli.cjs';
const HOOK_ENTRY_SRC = 'src/engine/hook-entry.ts';
const RUNNER_DTS = 'dist/hooks/runner.d.ts';

// 1. Inject shebang into CLI CJS entry if missing
const cliContent = readFileSync(CLI_CJS, 'utf8');
if (!cliContent.startsWith('#!')) {
  writeFileSync(CLI_CJS, '#!/usr/bin/env node\n' + cliContent);
  console.log('[postbuild] Injected shebang into', CLI_CJS);
}

// 2. Generate type declarations
execSync('npx tsc --emitDeclarationOnly --declaration --outDir dist', {
  stdio: 'inherit',
});
console.log('[postbuild] Generated type declarations');

// 3. Auto-generate runner.d.ts from the source export
//    Parse the actual export from hook-entry.ts so it stays in sync.
const hookEntrySource = readFileSync(HOOK_ENTRY_SRC, 'utf8');
const exportMatch = hookEntrySource.match(/^export\s+async\s+function\s+(\w+)/m);

if (exportMatch) {
  const fnName = exportMatch[1];
  const dtsContent = `export { ${fnName} } from '../engine/hook-entry.js';\n`;
  writeFileSync(RUNNER_DTS, dtsContent);
  console.log(`[postbuild] Generated ${RUNNER_DTS} (re-exports: ${fnName})`);
} else {
  // Fallback: write the known export name if parsing fails
  writeFileSync(RUNNER_DTS, "export { executeHook } from '../engine/hook-entry.js';\n");
  console.warn(
    '[postbuild] Warning: Could not parse export from',
    HOOK_ENTRY_SRC,
    '— using fallback',
  );
}
