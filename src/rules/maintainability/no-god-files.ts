import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  maxExports: z.number().int().positive().optional(),
});

/**
 * maintainability/no-god-files
 *
 * Warns when a file has too many exports, indicating it handles too many
 * responsibilities. "God files" are hard to navigate, test, and maintain.
 * AI agents frequently pile functionality into a single file.
 */
export const noGodFiles: Rule = {
  id: 'maintainability/no-god-files',
  name: 'No God Files',
  description: 'Warns when a file has too many exports (default: 15), suggesting it should be split.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'maintainability/no-god-files';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Skip index/barrel files — they're expected to re-export many things
    const filename = normalizePath(filePath).split('/').pop()?.toLowerCase() ?? '';
    if (filename.startsWith('index.')) return { status: 'pass', ruleId };

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts') || filePath.endsWith('.d.mts')) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const maxExports = (ruleConfig?.options?.maxExports as number) ?? 15;

    let exportCount = 0;

    // Count named exports: export const|function|class|type|interface|enum
    const namedExportPattern = /^export\s+(?:async\s+)?(?:const|function|class|type|interface|enum)\s+/gm;
    const namedMatches = content.match(namedExportPattern);
    if (namedMatches) exportCount += namedMatches.length;

    // Count re-exports: export { ... }
    const reexportPattern = /^export\s*\{([^}]+)\}/gm;
    let reMatch;
    while ((reMatch = reexportPattern.exec(content)) !== null) {
      const names = reMatch[1].split(',').filter((s) => s.trim());
      exportCount += names.length;
    }

    // Count export default
    if (/^export\s+default\b/m.test(content)) {
      exportCount++;
    }

    if (exportCount > maxExports) {
      return {
        status: 'warn',
        ruleId,
        message: `File has ${exportCount} exports (max: ${maxExports}). Consider splitting into focused modules.`,
        fix: 'Group related exports into separate files and use an index.ts barrel file.',
        metadata: { exportCount, maxExports },
      };
    }

    return { status: 'pass', ruleId };
  },
};
