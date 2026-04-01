import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

/**
 * quality/hallucination-guard
 *
 * Verifies that imported modules actually exist on disk.
 * Catches AI hallucinations where the model invents file paths.
 *
 * Only checks relative imports (starting with ./ or ../).
 * Skips node_modules, package imports, and path alias imports.
 */
export const hallucinationGuard: Rule = {
  id: 'quality/hallucination-guard',
  name: 'Hallucination Guard',
  description: 'Verifies imported files/modules actually exist on disk.',
  severity: 'warn',
  events: ['PostToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,

  check: async (context): Promise<RuleResult> => {
    const ruleId = 'quality/hallucination-guard';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    const fileDir = dirname(filePath);

    // Extract relative imports
    const importRegex = /(?:import|from)\s+['"](\.[^'"]+)['"]/g;
    let match;
    const missingImports: string[] = [];

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Resolve the import relative to the file
      const resolved = resolve(fileDir, importPath);
      const normalizedResolved = normalizePath(resolved);

      // Check if the file exists (with common extensions)
      const exists = checkFileExists(normalizedResolved);
      if (!exists) {
        missingImports.push(importPath);
      }
    }

    if (missingImports.length > 0) {
      return {
        status: 'warn',
        ruleId,
        message: `Import${missingImports.length > 1 ? 's' : ''} may reference non-existent file${missingImports.length > 1 ? 's' : ''}: ${missingImports.join(', ')}`,
        fix: `Verify these paths exist. The AI may have hallucinated a file path.`,
        metadata: { missingImports },
      };
    }

    return { status: 'pass', ruleId };
  },
};

/** Check if a file exists, trying common TypeScript/JavaScript extensions */
function checkFileExists(basePath: string): boolean {
  // Direct match
  if (existsSync(basePath)) return true;

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    if (existsSync(basePath + ext)) return true;
  }

  return false;
}
