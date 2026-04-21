import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const UNSAFE_BUN_SHELL: RegExp[] = [
  /\bBun\.spawn\s*\(\s*\[[^\]]*\$\{/,
  /\bBun\.\$\s*`[^`]*\$\{/,
  /\bBun\.spawnSync\s*\(\s*\[[^\]]*\$\{/,
];

/**
 * security/bun-shell-exec-scan (bun preset)
 *
 * Blocks Bun.spawn / Bun.$ calls with user-controlled interpolation.
 * Bun's shell API is fast but trivial to abuse for command injection.
 */
export const bunShellExecScan: Rule = {
  id: 'security/bun-shell-exec-scan',
  name: 'Bun Shell Exec Scan',
  description: 'Blocks Bun.spawn/$ calls with interpolated variables.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/bun-shell-exec-scan';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (UNSAFE_BUN_SHELL.some((p) => p.test(content))) {
      return {
        status: 'block',
        ruleId,
        message: 'Bun.spawn / Bun.$ call contains interpolated variables — command injection risk.',
        fix: 'Pass argv as a literal array with no interpolation, or validate each interpolated value against a strict pattern first.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
