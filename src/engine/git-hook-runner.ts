/**
 * Native git hook runner — replaces husky.
 *
 * Invoked by `.git/hooks/pre-commit` and `.git/hooks/commit-msg` scripts
 * that the `vguard install-hooks` CLI writes. Unlike the Claude Code hook
 * runner in `hook-entry.ts`, this path has no stdin JSON payload — it
 * synthesises the HookContext directly from the git environment.
 *
 * Exit codes:
 *   0  — no blocking rule tripped (even if warn-severity fired)
 *   3  — at least one rule returned block (EXIT.LINT_BLOCKING)
 *
 * Fail-open: any unexpected internal error exits 0. A vguard bug should
 * never make `git commit` unusable.
 */

import { existsSync, readFileSync } from 'node:fs';

import type { HookContext, HookEvent } from '../types.js';
import { loadCompiledConfigWithMetadata } from '../config/compile.js';
import { resolveRules } from './resolver.js';
import { runRules } from './runner.js';
import { recordRuleHit } from './tracker.js';
import { buildGitContext } from '../utils/git.js';

import '../rules/index.js';
import { loadLocalRules, loadLocalRulesFromPaths } from '../plugins/local-rule-loader.js';

type GitHookEvent = Extract<HookEvent, 'git:pre-commit' | 'git:commit-msg'>;

export interface GitHookOptions {
  /** Path to the commit-message file (only used for commit-msg) */
  commitMessageFile?: string;
  /** Override cwd (mainly for tests). Defaults to process.cwd() */
  cwd?: string;
}

const EXIT_OK = 0;
const EXIT_BLOCK = 3;

/**
 * Pure function that produces an exit code without touching process.exit,
 * so tests can assert the outcome deterministically and the top-level
 * entrypoint can still fail-open on unexpected errors.
 */
export async function computeGitHookExit(
  event: GitHookEvent,
  options: GitHookOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();

  const cached = await loadCompiledConfigWithMetadata(cwd);
  if (!cached) return EXIT_OK;
  const config = cached.config;

  if (cached.metadata.localRulePaths && cached.metadata.localRulePaths.length > 0) {
    await loadLocalRulesFromPaths(cwd, cached.metadata.localRulePaths);
  } else {
    await loadLocalRules(cwd);
  }

  const toolInput: Record<string, unknown> = { command: 'git commit' };

  if (event === 'git:commit-msg') {
    const msgFile = options.commitMessageFile ?? process.argv[2];
    if (msgFile && existsSync(msgFile)) {
      try {
        toolInput.commitMessage = readFileSync(msgFile, 'utf8');
        toolInput.commitMessageFile = msgFile;
      } catch {
        return EXIT_OK;
      }
    }
  }

  const gitContext = buildGitContext(cwd);

  const context: HookContext = {
    event,
    tool: 'git',
    toolInput,
    projectConfig: config,
    gitContext,
  };

  const resolved = resolveRules(event, 'git', config);
  if (resolved.length === 0) return EXIT_OK;

  const result = await runRules(resolved, context);

  for (const ruleResult of result.results) {
    try {
      recordRuleHit(ruleResult, event, 'git', undefined, cwd, undefined);
    } catch {
      // tracker failures never block a commit
    }
  }

  if (result.blocked && result.blockingResult) {
    const br = result.blockingResult;
    process.stderr.write(`\nvguard: ${br.message ?? 'commit blocked'}\n`);
    if (br.fix) process.stderr.write(`        fix: ${br.fix}\n`);
    process.stderr.write(
      `        rule: ${br.ruleId ?? 'unknown'} (bypass once with --no-verify at your own risk)\n\n`,
    );
    return EXIT_BLOCK;
  }

  for (const warn of result.warnings) {
    process.stderr.write(`vguard: ${warn.message ?? 'warning'}\n`);
  }

  return EXIT_OK;
}

export async function runGitHook(event: GitHookEvent, options: GitHookOptions = {}): Promise<void> {
  let code: number;
  try {
    code = await computeGitHookExit(event, options);
  } catch {
    // Fail open — a vguard bug must never wedge `git commit`.
    code = EXIT_OK;
  }
  process.exit(code);
}
