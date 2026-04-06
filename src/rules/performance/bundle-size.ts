import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  blockedImports: z.array(z.string()).optional(),
});

/**
 * Default heavy packages that should use tree-shakeable alternatives.
 * Format: [packageName, suggestion]
 */
const DEFAULT_BLOCKED: [string, string][] = [
  ['lodash', 'Use lodash-es or import specific methods: import { debounce } from "lodash/debounce"'],
  ['moment', 'Use date-fns, dayjs, or the native Intl/Temporal APIs'],
  ['rxjs', 'Import specific operators: import { map } from "rxjs/operators"'],
  ['underscore', 'Use lodash-es or native array methods'],
];

/**
 * performance/bundle-size
 *
 * Warns when imports pull in large dependencies as full-library imports.
 * AI agents frequently generate `import _ from 'lodash'` or `import moment`
 * instead of tree-shakeable alternatives.
 */
export const bundleSize: Rule = {
  id: 'performance/bundle-size',
  name: 'Bundle Size',
  description: 'Warns when imports pull in large dependencies that should use tree-shakeable alternatives.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'performance/bundle-size';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Get custom blocked imports from config
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const customBlocked = (ruleConfig?.options?.blockedImports as string[]) ?? [];

    const allBlocked = new Map<string, string>(
      DEFAULT_BLOCKED.map(([pkg, suggestion]) => [pkg, suggestion]),
    );
    for (const pkg of customBlocked) {
      allBlocked.set(pkg, `Consider a lighter alternative to "${pkg}".`);
    }

    const violations: { pkg: string; suggestion: string }[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Match: import ... from 'package' or import 'package'
      // But NOT: import ... from 'package/specific-path'
      const importMatch = trimmed.match(
        /(?:import\s+(?:[\w{},\s*]+\s+from\s+)?|import\s+)['"]([^'"]+)['"]/,
      );
      if (!importMatch) continue;

      const importPath = importMatch[1];

      for (const [pkg, suggestion] of allBlocked) {
        // Only match exact package imports, not sub-path imports like 'lodash/debounce'
        if (importPath === pkg) {
          violations.push({ pkg, suggestion });
          break;
        }
      }
    }

    if (violations.length > 0) {
      const pkgList = violations.map((v) => v.pkg).join(', ');
      return {
        status: 'warn',
        ruleId,
        message: `Full-library import detected: ${pkgList}. These increase bundle size significantly.`,
        fix: violations.map((v) => `${v.pkg}: ${v.suggestion}`).join('\n'),
        metadata: { packages: violations.map((v) => v.pkg) },
      };
    }

    return { status: 'pass', ruleId };
  },
};
