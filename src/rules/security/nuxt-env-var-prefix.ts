import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

const CLIENT_PATH_MARKERS = [
  /\/pages\//,
  /\/components\//,
  /\/layouts\//,
  /\/composables\//,
  /\.client\.(?:vue|ts|js)$/i,
];

function isClientFile(filePath: string): boolean {
  const p = normalizePath(filePath).toLowerCase();
  if (/\bserver\//.test(p) || /\.server\./.test(p)) return false;
  return CLIENT_PATH_MARKERS.some((re) => re.test(p));
}

export const nuxtEnvVarPrefix: Rule = {
  id: 'security/nuxt-env-var-prefix',
  name: 'Nuxt Env Var Prefix',
  description: 'Blocks non-NUXT_PUBLIC_ env vars being referenced from Nuxt client code.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nuxt-env-var-prefix';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['vue', 'ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    if (!isClientFile(filePath)) return { status: 'pass', ruleId };

    // Direct env references in client code
    const badEnv = content.match(
      /(?:process\.env|import\.meta\.env|useRuntimeConfig\(\)(?!\.public))\.([A-Z_][A-Z0-9_]*)/g,
    );
    if (!badEnv) return { status: 'pass', ruleId };

    const leaked = badEnv
      .map((m) => (m.match(/\.([A-Z_][A-Z0-9_]*)$/) ?? [])[1] ?? '')
      .filter((name) => name && !name.startsWith('NUXT_PUBLIC_'));
    if (leaked.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `Non-public env var(s) referenced in Nuxt client code: ${leaked.join(', ')}.`,
      fix: 'Use the NUXT_PUBLIC_ prefix for values that are safe to send to the client, and read via useRuntimeConfig().public.*.',
      metadata: { leaked },
    };
  },
};
