import type { HookContext, HookEvent, ResolvedConfig } from '../types.js';
import { buildGitContext } from '../utils/git.js';
import { isValidFilePath } from '../utils/validation.js';

/**
 * Raw hook input from Claude Code (JSON parsed from stdin).
 */
export interface RawHookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  /** Claude Code session identifier — forwarded onto HookContext + RuleHitRecord. */
  session_id?: string;
  [key: string]: unknown;
}

/**
 * Build a HookContext from raw Claude Code hook input.
 */
export function buildHookContext(
  event: HookEvent,
  rawInput: RawHookInput,
  config: ResolvedConfig,
): HookContext {
  const tool = rawInput.tool_name ?? '';
  const toolInput = rawInput.tool_input ?? {};
  const sessionId =
    typeof rawInput.session_id === 'string' && rawInput.session_id.length > 0
      ? rawInput.session_id
      : undefined;

  // Extract file path for git context, validating it does not contain shell metacharacters
  const rawFilePath = (toolInput.file_path as string) ?? (toolInput.path as string) ?? '';

  const filePath = rawFilePath && isValidFilePath(rawFilePath) ? rawFilePath : process.cwd();

  const gitContext = buildGitContext(filePath);

  return {
    event,
    tool,
    toolInput,
    projectConfig: config,
    gitContext,
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}
