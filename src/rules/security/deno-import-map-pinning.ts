import type { Rule, RuleResult } from '../../types.js';
import { normalizePath } from '../../utils/path.js';

export const denoImportMapPinning: Rule = {
  id: 'security/deno-import-map-pinning',
  name: 'Deno Import Map Pinning',
  description: 'Warns when deno.json imports include unpinned jsr:/npm: specifiers.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/deno-import-map-pinning';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\bdeno\.json[c]?$/.test(p) && !/\bimport[_-]?map\.json$/.test(p))
      return { status: 'pass', ruleId };
    // Flag jsr: or npm: specifiers that lack a version suffix.
    // Version suffix = @<x> AFTER the name (scoped packages like @std/fs
    // need the second @ for the version: jsr:@std/fs@^1.0.0).
    const re = /"(jsr|npm):([^"]+)"/g;
    let m: RegExpExecArray | null;
    const unpinned: string[] = [];
    while ((m = re.exec(content)) !== null) {
      const scheme = m[1];
      const spec = m[2] ?? '';
      // Strip a leading @scope/ prefix before checking for @version.
      const nameAndVersion = spec.startsWith('@') ? spec.replace(/^@[^/]+\//, '') : spec;
      if (!nameAndVersion.includes('@')) {
        unpinned.push(`${scheme}:${spec}`);
      }
    }
    if (unpinned.length === 0) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: `Unpinned jsr:/npm: specifier(s): ${unpinned.slice(0, 5).join(', ')}${unpinned.length > 5 ? ', …' : ''}.`,
      fix: 'Pin to an exact version: "jsr:@std/fs@^1.0.0" or "npm:lodash@4.17.21".',
    };
  },
};
