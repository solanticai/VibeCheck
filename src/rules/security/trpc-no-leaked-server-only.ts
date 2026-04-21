import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

function isClientFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  if (/\/(server|api|routers?|trpc)\//.test(p)) return false;
  return /\/(pages|app|components|src)\//.test(p);
}

export const trpcNoLeakedServerOnly: Rule = {
  id: 'security/trpc-no-leaked-server-only',
  name: 'tRPC No Leaked Server-Only',
  description: 'Warns when client code imports tRPC server files (router definitions, context).',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/trpc-no-leaked-server-only';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (!isClientFile(filePath)) return { status: 'pass', ruleId };

    const re = /from\s+['"]([^'"]*)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const spec = m[1] ?? '';
      if (/\/(server|routers?|trpc\/context|trpc\/server)\//.test(spec)) {
        return {
          status: 'warn',
          ruleId,
          message: `Client file imports from server path "${spec}" — risks bundling server code.`,
          fix: 'Import only inferred types from the server: `import type { AppRouter } from "../server/router";`. Use the tRPC client for runtime calls.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
