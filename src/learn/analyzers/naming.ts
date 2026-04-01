import type { WalkedFile } from '../walker.js';
import type { AnalyzerResult, DiscoveredPattern } from './types.js';

type NamingStyle = 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'other';

/**
 * Analyze file and function naming conventions.
 *
 * Discovers:
 * - Dominant file naming style per directory type
 * - Component file naming patterns
 * - Hook file naming patterns
 */
export function analyzeNaming(files: WalkedFile[]): AnalyzerResult {
  const patterns: DiscoveredPattern[] = [];

  if (files.length === 0) {
    return { analyzer: 'naming', patterns, filesAnalyzed: 0 };
  }

  // Group files by parent directory pattern
  const dirGroups = new Map<string, WalkedFile[]>();
  for (const file of files) {
    // Extract the last directory segment
    const parts = file.directory.split('/');
    const lastDir = parts[parts.length - 1]?.toLowerCase() ?? '';
    const existing = dirGroups.get(lastDir) ?? [];
    existing.push(file);
    dirGroups.set(lastDir, existing);
  }

  // Analyze naming in component directories
  const componentDirs = ['components', '_components', 'ui'];
  for (const dirName of componentDirs) {
    const dirFiles = dirGroups.get(dirName);
    if (!dirFiles || dirFiles.length < 2) continue;

    const styleCounts = countNamingStyles(dirFiles);
    const dominant = getDominantStyle(styleCounts);

    if (dominant && styleCounts.get(dominant)! / dirFiles.length >= 0.7) {
      patterns.push({
        type: 'naming',
        description: `Component files in /${dirName}/ use ${dominant} naming (${styleCounts.get(dominant)}/${dirFiles.length} files)`,
        confidence: styleCounts.get(dominant)! / dirFiles.length,
        occurrences: styleCounts.get(dominant)!,
        totalFiles: dirFiles.length,
        examples: dirFiles.slice(0, 3).map((f) => f.filename),
        promotable: dominant === 'PascalCase',
        suggestedRule:
          dominant === 'PascalCase'
            ? { ruleId: 'quality/naming-conventions', config: { componentDirs: [`/${dirName}/`] } }
            : undefined,
      });
    }
  }

  // Analyze naming in hook directories
  const hookDirs = ['hooks', '_hooks'];
  for (const dirName of hookDirs) {
    const dirFiles = dirGroups.get(dirName);
    if (!dirFiles || dirFiles.length < 2) continue;

    const usePrefix = dirFiles.filter(
      (f) => f.filename.startsWith('use') || f.filename.startsWith('Use'),
    );
    const ratio = usePrefix.length / dirFiles.length;

    if (ratio >= 0.7) {
      patterns.push({
        type: 'naming',
        description: `Hook files in /${dirName}/ use "use" prefix (${usePrefix.length}/${dirFiles.length} files)`,
        confidence: ratio,
        occurrences: usePrefix.length,
        totalFiles: dirFiles.length,
        examples: usePrefix.slice(0, 3).map((f) => f.filename),
        promotable: true,
        suggestedRule: {
          ruleId: 'quality/naming-conventions',
          config: { hookDirs: [`/${dirName}/`] },
        },
      });
    }
  }

  // Analyze overall file naming style
  const allStyleCounts = countNamingStyles(files);
  const dominantOverall = getDominantStyle(allStyleCounts);
  if (dominantOverall) {
    const ratio = allStyleCounts.get(dominantOverall)! / files.length;
    if (ratio >= 0.5) {
      patterns.push({
        type: 'naming',
        description: `Project predominantly uses ${dominantOverall} file naming (${Math.round(ratio * 100)}%)`,
        confidence: ratio,
        occurrences: allStyleCounts.get(dominantOverall)!,
        totalFiles: files.length,
        examples: [],
        promotable: false,
      });
    }
  }

  return { analyzer: 'naming', patterns, filesAnalyzed: files.length };
}

function detectNamingStyle(filename: string): NamingStyle {
  const base = filename.split('.')[0];
  if (!base || base === 'index') return 'other';

  if (/^[A-Z][a-zA-Z0-9]*$/.test(base)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(base)) return 'camelCase';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(base)) return 'kebab-case';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(base)) return 'snake_case';

  return 'other';
}

function countNamingStyles(files: WalkedFile[]): Map<NamingStyle, number> {
  const counts = new Map<NamingStyle, number>();
  for (const file of files) {
    const style = detectNamingStyle(file.filename);
    if (style === 'other') continue;
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  return counts;
}

function getDominantStyle(counts: Map<NamingStyle, number>): NamingStyle | null {
  let max = 0;
  let dominant: NamingStyle | null = null;
  for (const [style, count] of counts) {
    if (count > max) {
      max = count;
      dominant = style;
    }
  }
  return dominant;
}
