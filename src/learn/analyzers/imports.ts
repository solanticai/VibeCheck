import type { WalkedFile } from '../walker.js';
import type { AnalyzerResult, DiscoveredPattern } from './types.js';

const JS_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs']);

/**
 * Analyze import patterns across the codebase.
 *
 * Discovers:
 * - Path alias usage (@/, ~/, #/)
 * - Most common import sources
 * - Deep relative import frequency
 */
export function analyzeImports(files: WalkedFile[]): AnalyzerResult {
  const jsFiles = files.filter((f) => JS_EXTENSIONS.has(f.extension));
  const patterns: DiscoveredPattern[] = [];

  if (jsFiles.length === 0) {
    return { analyzer: 'imports', patterns, filesAnalyzed: 0 };
  }

  // Count alias usage
  const aliasCounts = new Map<string, { count: number; examples: string[] }>();
  const importSourceCounts = new Map<string, number>();
  let deepRelativeCount = 0;
  let srcImportCount = 0;
  let filesWithImports = 0;

  for (const file of jsFiles) {
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    let hasImports = false;

    while ((match = importRegex.exec(file.content)) !== null) {
      hasImports = true;
      const source = match[1];

      // Track import sources (top-level package name)
      if (!source.startsWith('.') && !source.startsWith('/')) {
        const pkg = source.startsWith('@')
          ? source.split('/').slice(0, 2).join('/')
          : source.split('/')[0];
        importSourceCounts.set(pkg, (importSourceCounts.get(pkg) ?? 0) + 1);
      }

      // Track alias usage
      const aliasMatch = source.match(/^(@|~|#)\//);
      if (aliasMatch) {
        const alias = aliasMatch[0];
        const entry = aliasCounts.get(alias) ?? { count: 0, examples: [] };
        entry.count++;
        if (entry.examples.length < 3) entry.examples.push(file.path);
        aliasCounts.set(alias, entry);
      }

      // Track deep relative imports
      if (/^(\.\.\/){4,}/.test(source)) {
        deepRelativeCount++;
      }

      // Track src/ imports
      if (source.startsWith('src/')) {
        srcImportCount++;
      }
    }

    if (hasImports) filesWithImports++;
  }

  // Report alias usage
  for (const [alias, data] of aliasCounts) {
    const confidence = filesWithImports > 0 ? Math.min(data.count / filesWithImports, 1) : 0;
    if (confidence >= 0.1) {
      patterns.push({
        type: 'import',
        description: `Path alias "${alias}" is used in ${data.count} imports`,
        confidence,
        occurrences: data.count,
        totalFiles: filesWithImports,
        examples: data.examples,
        promotable: true,
        suggestedRule: {
          ruleId: 'quality/import-aliases',
          config: { aliases: [alias] },
        },
      });
    }
  }

  // Report deep relative imports as anti-pattern
  if (deepRelativeCount > 0) {
    patterns.push({
      type: 'import',
      description: `${deepRelativeCount} deep relative imports (4+ levels of ../) detected`,
      confidence: Math.min(deepRelativeCount / filesWithImports, 1),
      occurrences: deepRelativeCount,
      totalFiles: filesWithImports,
      examples: [],
      promotable: true,
      suggestedRule: {
        ruleId: 'quality/import-aliases',
        config: {},
      },
    });
  }

  // Report src/ imports
  if (srcImportCount > 0) {
    patterns.push({
      type: 'import',
      description: `${srcImportCount} imports use "src/" path instead of alias`,
      confidence: Math.min(srcImportCount / filesWithImports, 1),
      occurrences: srcImportCount,
      totalFiles: filesWithImports,
      examples: [],
      promotable: true,
      suggestedRule: {
        ruleId: 'quality/import-aliases',
        config: {},
      },
    });
  }

  // Report top import sources
  const topSources = Array.from(importSourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topSources.length > 0) {
    patterns.push({
      type: 'import',
      description: `Top import sources: ${topSources.map(([pkg, count]) => `${pkg} (${count})`).join(', ')}`,
      confidence: 1,
      occurrences: topSources.reduce((sum, [, count]) => sum + count, 0),
      totalFiles: filesWithImports,
      examples: [],
      promotable: false,
    });
  }

  return { analyzer: 'imports', patterns, filesAnalyzed: jsFiles.length };
}
