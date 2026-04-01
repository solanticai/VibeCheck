/**
 * Hook entry point for generated hook scripts.
 * This module is imported by generated hook scripts via `require('vibecheck/hooks/runner')`.
 *
 * It reads stdin, builds context, resolves rules, runs them, and outputs results.
 */

import type { HookEvent } from '../types.js';
import { parseStdinJson, extractToolInput } from '../utils/stdin.js';
import { loadCompiledConfig } from '../config/compile.js';
import { buildHookContext } from './context.js';
import { resolveRules } from './resolver.js';
import { runRules } from './runner.js';
import { formatPreToolUseOutput, formatPostToolUseOutput, formatStopOutput } from './output.js';

// Import and register all built-in rules
import '../rules/index.js';

/**
 * Main hook execution function.
 * Called by generated hook scripts with the event type.
 */
export async function executeHook(event: HookEvent): Promise<void> {
  try {
    // 1. Parse stdin
    const rawInput = parseStdinJson();
    if (!rawInput) {
      process.exit(0); // Fail open on missing/invalid input
    }

    // 2. Load pre-compiled config (fast path)
    const config = await loadCompiledConfig(process.cwd());
    if (!config) {
      process.exit(0); // No config = no enforcement
    }

    // 3. Extract tool info
    const { toolName } = extractToolInput(rawInput);

    // 4. Build context
    const context = buildHookContext(
      event,
      {
        tool_name: toolName,
        tool_input: rawInput.tool_input as Record<string, unknown>,
        ...rawInput,
      },
      config,
    );

    // 5. Resolve which rules apply
    const resolvedRules = resolveRules(event, toolName, config);
    if (resolvedRules.length === 0) {
      process.exit(0); // No matching rules
    }

    // 6. Run rules
    const result = await runRules(resolvedRules, context);

    // 7. Format and output
    if (event === 'PreToolUse') {
      const output = formatPreToolUseOutput(result);
      if (output.stderr) process.stderr.write(output.stderr);
      if (output.stdout) process.stdout.write(output.stdout);
      process.exit(output.exitCode);
    } else if (event === 'PostToolUse') {
      const output = formatPostToolUseOutput(result);
      if (output.stdout) process.stdout.write(output.stdout);
      process.exit(output.exitCode);
    } else {
      const output = formatStopOutput(result);
      if (output.stderr) process.stderr.write(output.stderr);
      process.exit(output.exitCode);
    }
  } catch {
    // Fail open — never block on internal errors
    process.exit(0);
  }
}
