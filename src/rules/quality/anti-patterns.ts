import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const configSchema = z.object({
  blockCssFiles: z.boolean().optional(),
  blockInlineStyles: z.boolean().optional(),
  blockConsoleLog: z.boolean().optional(),
});

/**
 * quality/anti-patterns
 *
 * Catches common AI coding mistakes:
 * - CSS/SCSS files in Tailwind projects (should use utility classes)
 * - Inline styles where Tailwind is configured
 * - console.log statements in production code
 *
 * Configurable per-preset: Tailwind preset enables CSS blocking.
 */
export const antiPatterns: Rule = {
  id: 'quality/anti-patterns',
  name: 'Anti-Patterns',
  description:
    'Catches common AI coding mistakes: CSS in Tailwind projects, inline styles, console.log.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'quality/anti-patterns';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const blockCssFiles = (ruleConfig?.options?.blockCssFiles as boolean) ?? false;
    const blockInlineStyles = (ruleConfig?.options?.blockInlineStyles as boolean) ?? false;
    const blockConsoleLog = (ruleConfig?.options?.blockConsoleLog as boolean) ?? false;

    const ext = getExtension(filePath);

    // Check: CSS/SCSS files in Tailwind projects
    if (blockCssFiles && ['css', 'scss', 'sass', 'less'].includes(ext)) {
      const filename = filePath.split(/[/\\]/).pop() ?? '';
      // Allow globals.css and reset files
      if (!filename.match(/^(globals?|reset|normalize)\./i)) {
        return {
          status: 'warn',
          ruleId,
          message: `CSS file "${filename}" detected in a Tailwind project. Use Tailwind utility classes instead.`,
          fix: `Use Tailwind CSS classes directly in your components instead of writing custom CSS.`,
        };
      }
    }

    // Check: Inline styles in TSX/JSX
    if (blockInlineStyles && ['tsx', 'jsx'].includes(ext)) {
      if (/style=\{\{/.test(content)) {
        return {
          status: 'warn',
          ruleId,
          message: `Inline styles detected. Use Tailwind utility classes or CSS modules instead.`,
          fix: `Replace style={{...}} with Tailwind classes: className="..."`,
        };
      }
    }

    // Check: console.log in production code
    if (blockConsoleLog && ['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      // Skip test files
      if (!filePath.match(/\.(test|spec|stories)\./)) {
        if (/\bconsole\.log\s*\(/.test(content)) {
          return {
            status: 'warn',
            ruleId,
            message: `console.log() detected. Use a proper logger in production code.`,
            fix: `Replace console.log() with your project's logger or remove it.`,
          };
        }
      }
    }

    return { status: 'pass', ruleId };
  },
};
