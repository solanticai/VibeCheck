import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

function extractImports(content: string, ext: string): string[] {
  const names = new Set<string>();
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    const re = /(?:import\s+[^'"]*?\s+from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const spec = m[1];
      if (!spec) continue;
      if (spec.startsWith('.') || spec.startsWith('/')) continue; // relative / absolute
      if (spec.startsWith('node:')) continue; // built-in
      // Bare specifier — extract package name (handles scoped)
      const segs = spec.split('/');
      const name = spec.startsWith('@') ? `${segs[0]}/${segs[1]}` : segs[0];
      if (name) names.add(name);
    }
  }
  return [...names];
}

function loadPackageManifest(repoRoot: string): Record<string, unknown> | null {
  try {
    const p = join(repoRoot, 'package.json');
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isPackageDeclared(pkg: Record<string, unknown>, name: string): boolean {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  return sections.some((s) => {
    const section = pkg[s];
    return section && typeof section === 'object' && name in (section as Record<string, unknown>);
  });
}

function isInNodeModules(repoRoot: string, name: string): boolean {
  return existsSync(join(repoRoot, 'node_modules', name, 'package.json'));
}

/**
 * quality/package-existence-check
 *
 * After a file is written, verify every new bare import resolves to a
 * declared dependency in package.json or an installed node_modules entry.
 * Flags slopsquat-shaped names that the AI hallucinated. Addresses OWASP
 * LLM09 (Misinformation).
 */
export const packageExistenceCheck: Rule = {
  id: 'quality/package-existence-check',
  name: 'Package Existence Check',
  description: 'Blocks imports of packages that are not declared and not installed.',
  severity: 'block',
  events: ['PostToolUse'],
  match: { tools: ['Write'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'quality/package-existence-check';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const repoRoot = context.gitContext.repoRoot;
    if (!content || !filePath || !repoRoot) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    const imports = extractImports(content, ext);
    if (imports.length === 0) return { status: 'pass', ruleId };

    const pkg = loadPackageManifest(repoRoot);
    const missing: string[] = [];
    for (const name of imports) {
      const declared = pkg ? isPackageDeclared(pkg, name) : false;
      const installed = isInNodeModules(repoRoot, name);
      if (!declared && !installed) missing.push(name);
    }

    if (missing.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `Imports reference package(s) not declared in package.json and not in node_modules: ${missing.join(', ')}.`,
      fix: 'Verify each name on the official registry. AI models frequently hallucinate package names (USENIX 2025 measured ~20% rate). If intentional, add to package.json first.',
      metadata: { missing },
    };
  },
};
