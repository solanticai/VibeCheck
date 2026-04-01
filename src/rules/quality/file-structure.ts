import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

const configSchema = z.object({
  framework: z.enum(['nextjs', 'react', 'generic']).optional(),
});

/**
 * quality/file-structure
 *
 * Validates file placement follows framework conventions:
 * - Components should be in component directories
 * - Hooks should be in hook directories
 * - Next.js pages follow App Router conventions
 */
export const fileStructure: Rule = {
  id: 'quality/file-structure',
  name: 'File Structure',
  description: 'Validates file placement follows framework conventions.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'quality/file-structure';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const normalized = normalizePath(filePath).toLowerCase();
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

    if (!['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    // Detect React component (exports a function component or uses JSX)
    const isComponent =
      ext === 'tsx' || ext === 'jsx'
        ? /export\s+(default\s+)?function\s+[A-Z]/.test(content) ||
          /export\s+const\s+[A-Z]\w+\s*[:=]/.test(content)
        : false;

    // Detect React hook (function starting with "use")
    const isHook = /export\s+(default\s+)?function\s+use[A-Z]/.test(content) ||
                   /export\s+const\s+use[A-Z]\w+\s*=/.test(content);

    // Warn if a component is placed outside common component directories
    if (isComponent && !isHook) {
      const isInComponentDir =
        normalized.includes('/components/') ||
        normalized.includes('/_components/') ||
        normalized.includes('/app/') || // Next.js app dir pages are OK
        normalized.includes('/pages/');

      if (!isInComponentDir) {
        return {
          status: 'warn',
          ruleId,
          message: `React component detected outside a standard component directory.`,
          fix: `Consider moving to a /components/ directory or a co-located _components/ folder.`,
        };
      }
    }

    // Warn if a hook is placed outside hook directories
    if (isHook) {
      const isInHookDir =
        normalized.includes('/hooks/') ||
        normalized.includes('/_hooks/');

      if (!isInHookDir) {
        return {
          status: 'warn',
          ruleId,
          message: `React hook detected outside a standard hooks directory.`,
          fix: `Consider moving to a /hooks/ directory or a co-located _hooks/ folder.`,
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
