import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  allowInScripts: z.boolean().optional(),
  allowInConfig: z.boolean().optional(),
});

/** Synchronous IO patterns to detect */
const SYNC_PATTERNS: [RegExp, string][] = [
  [/\breadFileSync\s*\(/, 'readFileSync'],
  [/\bwriteFileSync\s*\(/, 'writeFileSync'],
  [/\bappendFileSync\s*\(/, 'appendFileSync'],
  [/\bmkdirSync\s*\(/, 'mkdirSync'],
  [/\breaddirSync\s*\(/, 'readdirSync'],
  [/\bstatSync\s*\(/, 'statSync'],
  [/\bexistsSync\s*\(/, 'existsSync'],
  [/\bexecSync\s*\(/, 'execSync'],
  [/\bspawnSync\s*\(/, 'spawnSync'],
  [/\bnew\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
];

/**
 * performance/no-sync-io
 *
 * Warns when synchronous file/network IO operations appear in source code.
 * Synchronous operations block the event loop and degrade performance in
 * server-side code (API routes, edge functions, middleware).
 */
export const noSyncIo: Rule = {
  id: 'performance/no-sync-io',
  name: 'No Sync IO',
  description: 'Warns about synchronous file/network IO operations that block the event loop.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'performance/no-sync-io';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const allowInScripts = (ruleConfig?.options?.allowInScripts as boolean) ?? true;
    const allowInConfig = (ruleConfig?.options?.allowInConfig as boolean) ?? true;

    const normalized = normalizePath(filePath).toLowerCase();

    // Skip scripts directory by default
    if (allowInScripts && normalized.includes('/scripts/')) return { status: 'pass', ruleId };

    // Skip config files by default
    if (allowInConfig) {
      const filename = normalized.split('/').pop() ?? '';
      if (/^(vite|next|tailwind|postcss|jest|vitest|webpack|rollup|tsup|eslint|prettier)\.config\./.test(filename)) {
        return { status: 'pass', ruleId };
      }
    }

    const found: string[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      for (const [pattern, name] of SYNC_PATTERNS) {
        if (pattern.test(trimmed) && !found.includes(name)) {
          found.push(name);
        }
      }
    }

    if (found.length > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `Synchronous IO detected: ${found.join(', ')}. These block the event loop.`,
        fix: 'Use async alternatives: readFile, writeFile, mkdir, readdir, exec, spawn.',
        metadata: { syncMethods: found },
      };
    }

    return { status: 'pass', ruleId };
  },
};
