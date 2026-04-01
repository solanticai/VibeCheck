import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

/**
 * quality/dead-exports
 *
 * After a file is written, checks if any of its exports are imported
 * anywhere else in the project. Flags orphaned exports that may indicate
 * hallucinated API surfaces.
 *
 * Only runs on PostToolUse to avoid blocking writes. This is a heuristic
 * check — it searches for import references in nearby files.
 */
export const deadExports: Rule = {
  id: 'quality/dead-exports',
  name: 'Dead Exports',
  description: 'Flags exported symbols not imported anywhere in the project.',
  severity: 'warn',
  events: ['PostToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'quality/dead-exports';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    // Skip index files — they re-export and are expected to have many exports
    const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() ?? '';
    if (filename.startsWith('index.')) return { status: 'pass', ruleId };

    // Extract named exports
    const exportPattern = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;
    const exports: string[] = [];
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Also check for `export { name }` syntax
    const reexportPattern = /export\s*\{([^}]+)\}/g;
    while ((match = reexportPattern.exec(content)) !== null) {
      const names = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
      exports.push(...names.filter(Boolean));
    }

    if (exports.length === 0) return { status: 'pass', ruleId };

    // Skip checking if this is a default-only export
    if (exports.length === 1 && /export\s+default\b/.test(content)) {
      return { status: 'pass', ruleId };
    }

    // Search nearby files for imports referencing this file
    const projectRoot = context.gitContext.repoRoot;
    if (!projectRoot) return { status: 'pass', ruleId };

    const fileDir = dirname(filePath);
    const relFromRoot = relative(projectRoot, filePath)
      .replace(/\\/g, '/')
      .replace(/\.\w+$/, '');

    // Collect import references from nearby source files
    const searchDirs = [fileDir, dirname(fileDir)];
    const importedNames = new Set<string>();

    for (const searchDir of searchDirs) {
      try {
        const entries = readdirSync(searchDir);
        for (const entry of entries) {
          const entryPath = join(searchDir, entry);
          try {
            if (!statSync(entryPath).isFile()) continue;
          } catch {
            continue;
          }
          const entryExt = entry.split('.').pop()?.toLowerCase() ?? '';
          if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(entryExt)) continue;
          if (entryPath === filePath) continue;

          let source: string;
          try {
            source = readFileSync(entryPath, 'utf-8');
          } catch {
            continue;
          }

          // Check if this file imports from our target
          const fileBase = filename.replace(/\.\w+$/, '');
          if (!source.includes(fileBase) && !source.includes(relFromRoot)) continue;

          // Extract imported names
          const importNames = /import\s*\{([^}]+)\}\s*from/g;
          let impMatch;
          while ((impMatch = importNames.exec(source)) !== null) {
            const names = impMatch[1]
              .split(',')
              .map((s) => s.trim().split(/\s+as\s+/)[0].trim());
            names.forEach((n) => importedNames.add(n));
          }
        }
      } catch {
        continue;
      }
    }

    // Find exports not imported anywhere
    const deadExportsList = exports.filter((e) => !importedNames.has(e));

    // Only warn if ALL exports are dead (likely a new file with hallucinated API)
    if (deadExportsList.length === exports.length && exports.length > 1) {
      return {
        status: 'warn',
        ruleId,
        message: `None of the ${exports.length} exports are imported anywhere nearby: ${deadExportsList.slice(0, 5).join(', ')}${deadExportsList.length > 5 ? '...' : ''}.`,
        fix: 'Verify these exports are needed. The AI may have created an API surface that nothing uses.',
        metadata: { deadExports: deadExportsList, totalExports: exports.length },
      };
    }

    return { status: 'pass', ruleId };
  },
};
