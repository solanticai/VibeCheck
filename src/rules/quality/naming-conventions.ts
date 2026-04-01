import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath, getFilename } from '../../utils/path.js';

const configSchema = z.object({
  componentDirs: z.array(z.string()).optional(),
  hookDirs: z.array(z.string()).optional(),
  vagueFilenames: z.array(z.string()).optional(),
  allowedVagueFiles: z.array(z.string()).optional(),
});

const DEFAULT_COMPONENT_DIRS = ['/components/', '/_components/'];
const DEFAULT_HOOK_DIRS = ['/hooks/', '/_hooks/'];
const DEFAULT_VAGUE_FILENAMES = ['utils.ts', 'helpers.ts', 'misc.ts', 'utils.tsx', 'helpers.tsx', 'misc.tsx'];

/**
 * quality/naming-conventions
 *
 * Enforces:
 * - PascalCase for component files in component directories
 * - "use" prefix for hook files in hook directories
 * - No vague filenames (utils.ts, helpers.ts, misc.ts)
 *
 * Ported from Lumioh's validate-code-patterns.py checks 5-7.
 */
export const namingConventions: Rule = {
  id: 'quality/naming-conventions',
  name: 'Naming Conventions',
  description: 'Enforces PascalCase components, use-prefixed hooks, and descriptive filenames.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'quality/naming-conventions';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!filePath) return { status: 'pass', ruleId };

    const normalized = normalizePath(filePath).toLowerCase();
    const filename = getFilename(filePath);
    const filenameBase = filename.split('.')[0];

    // Get config
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const componentDirs = (ruleConfig?.options?.componentDirs as string[]) ?? DEFAULT_COMPONENT_DIRS;
    const hookDirs = (ruleConfig?.options?.hookDirs as string[]) ?? DEFAULT_HOOK_DIRS;
    const vagueFilenames = (ruleConfig?.options?.vagueFilenames as string[]) ?? DEFAULT_VAGUE_FILENAMES;
    const allowedVagueFiles = (ruleConfig?.options?.allowedVagueFiles as string[]) ?? [];

    // Check: No vague filenames
    if (vagueFilenames.includes(filename.toLowerCase())) {
      // Check allowlist
      const isAllowed = allowedVagueFiles.some((allowed) =>
        normalizePath(filePath).toLowerCase().includes(normalizePath(allowed).toLowerCase()),
      );
      if (!isAllowed) {
        return {
          status: 'block',
          ruleId,
          message: `Vague filename "${filename}" detected. Use a descriptive name that indicates the file's purpose.`,
          fix: `Rename to something specific like "date-utils.ts", "string-helpers.ts", or "validation.ts".`,
        };
      }
    }

    // Check: PascalCase for components
    const isInComponentDir = componentDirs.some((dir) => normalized.includes(dir.toLowerCase()));
    if (isInComponentDir && /\.(tsx?|jsx?)$/.test(filename)) {
      // Skip index files and non-component files
      if (filenameBase !== 'index' && filenameBase !== 'page' && filenameBase !== 'layout') {
        const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(filenameBase);
        if (!isPascalCase) {
          return {
            status: 'block',
            ruleId,
            message: `Component file "${filename}" should use PascalCase naming (e.g., "${toPascalCase(filenameBase)}.tsx").`,
            fix: `Rename to "${toPascalCase(filenameBase)}.${filename.split('.').pop()}"`,
          };
        }
      }
    }

    // Check: "use" prefix for hooks
    const isInHookDir = hookDirs.some((dir) => normalized.includes(dir.toLowerCase()));
    if (isInHookDir && /\.(tsx?|jsx?)$/.test(filename)) {
      if (filenameBase !== 'index') {
        const hasUsePrefix = filenameBase.startsWith('use') || filenameBase.startsWith('Use');
        if (!hasUsePrefix) {
          return {
            status: 'block',
            ruleId,
            message: `Hook file "${filename}" should start with "use" prefix (e.g., "use${capitalize(filenameBase)}.ts").`,
            fix: `Rename to "use${capitalize(filenameBase)}.${filename.split('.').pop()}"`,
          };
        }
      }
    }

    return { status: 'pass', ruleId };
  },
};

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
