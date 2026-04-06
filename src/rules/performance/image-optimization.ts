import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';
import { isTestFile, isGeneratedFile } from '../../utils/code-analysis.js';

const configSchema = z.object({
  framework: z.enum(['nextjs', 'astro', 'generic']).optional(),
});

/**
 * performance/image-optimization
 *
 * Warns when raw HTML <img> tags are used in JSX files instead of
 * framework-optimized image components (next/image, astro:assets).
 * Framework image components provide lazy loading, format optimization,
 * and responsive sizing out of the box.
 */
export const imageOptimization: Rule = {
  id: 'performance/image-optimization',
  name: 'Image Optimization',
  description: 'Warns when raw <img> tags are used instead of framework image components.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'performance/image-optimization';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['tsx', 'jsx'].includes(ext)) return { status: 'pass', ruleId };

    if (isTestFile(filePath) || isGeneratedFile(filePath)) return { status: 'pass', ruleId };

    // Skip Storybook stories
    if (/\.stories\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    // Check if file already imports an image component
    const hasNextImage = /import\s+.*\bImage\b.*from\s+['"]next\/image['"]/.test(content);
    const hasAstroImage = /import\s+.*\bImage\b.*from\s+['"]astro:assets['"]/.test(content);
    if (hasNextImage || hasAstroImage) return { status: 'pass', ruleId };

    // Detect raw <img> tags in JSX
    const imgPattern = /<img\s/g;
    let count = 0;

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // Skip strings (rough heuristic: line is mostly a string assignment)
      if (/^\s*(?:const|let|var)\s+\w+\s*=\s*['"`]/.test(line)) continue;

      const matches = trimmed.match(imgPattern);
      if (matches) count += matches.length;
    }

    if (count === 0) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const framework = (ruleConfig?.options?.framework as string) ?? 'nextjs';

    const suggestion =
      framework === 'nextjs'
        ? 'Use next/image: import Image from "next/image"'
        : framework === 'astro'
          ? 'Use astro:assets: import { Image } from "astro:assets"'
          : 'Use your framework\'s optimized image component.';

    return {
      status: 'warn',
      ruleId,
      message: `${count} raw <img> tag${count > 1 ? 's' : ''} detected. Use an optimized image component for better performance.`,
      fix: suggestion,
      metadata: { count, framework },
    };
  },
};
