import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

/**
 * reliability/no-unhandled-promises
 *
 * Warns when promise chains use .then() without .catch(), which can lead
 * to unhandled rejections that crash the process or silently fail.
 * Conservative detection — only flags clear patterns.
 */
export const noUnhandledPromises: Rule = {
  id: 'reliability/no-unhandled-promises',
  name: 'No Unhandled Promises',
  description: 'Warns when .then() is used without .catch() on the same promise chain.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'reliability/no-unhandled-promises';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts')) return { status: 'pass', ruleId };

    let violations = 0;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Detect .then( without .catch( on same line or next few lines
      if (/\.then\s*\(/.test(trimmed)) {
        // Check current line and next 3 lines for .catch(
        let hasCatch = false;
        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          if (/\.catch\s*\(/.test(lines[j])) {
            hasCatch = true;
            break;
          }
          // Also check for .finally() as it might indicate error handling upstream
          if (/\.finally\s*\(/.test(lines[j]) && j > i) {
            // .finally without .catch still doesn't handle rejections, but
            // check if there's a .catch before the .finally
            for (let k = i; k <= j; k++) {
              if (/\.catch\s*\(/.test(lines[k])) {
                hasCatch = true;
                break;
              }
            }
            break;
          }
        }

        if (!hasCatch) {
          violations++;
        }
      }
    }

    if (violations > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `${violations} .then() chain${violations > 1 ? 's' : ''} without .catch() detected. Unhandled rejections can crash the process.`,
        fix: 'Add .catch() to promise chains, or use async/await with try/catch.',
        metadata: { violations },
      };
    }

    return { status: 'pass', ruleId };
  },
};
