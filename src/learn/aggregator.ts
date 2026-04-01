import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { WalkedFile } from './walker.js';
import type { AnalyzerResult, DiscoveredPattern } from './analyzers/types.js';
import { analyzeImports } from './analyzers/imports.js';
import { analyzeNaming } from './analyzers/naming.js';
import { analyzeStructure } from './analyzers/structure.js';

/** Complete convention learning output */
export interface ConventionsReport {
  generatedAt: string;
  projectRoot: string;
  filesAnalyzed: number;
  analyzers: AnalyzerResult[];
  /** All patterns sorted by confidence */
  allPatterns: DiscoveredPattern[];
  /** Only promotable patterns (can become rules) */
  promotablePatterns: DiscoveredPattern[];
}

/**
 * Run all analyzers on the walked files and aggregate results.
 */
export function aggregateConventions(files: WalkedFile[], projectRoot: string): ConventionsReport {
  const analyzers: AnalyzerResult[] = [
    analyzeImports(files),
    analyzeNaming(files),
    analyzeStructure(files),
  ];

  const allPatterns = analyzers
    .flatMap((a) => a.patterns)
    .sort((a, b) => b.confidence - a.confidence);

  const promotablePatterns = allPatterns.filter((p) => p.promotable);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    filesAnalyzed: files.length,
    analyzers,
    allPatterns,
    promotablePatterns,
  };
}

/**
 * Save conventions report to .vibecheck/learned/conventions.json
 */
export async function saveConventions(
  report: ConventionsReport,
  projectRoot: string,
): Promise<string> {
  const outputPath = join(projectRoot, '.vibecheck', 'learned', 'conventions.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}
