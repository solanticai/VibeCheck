import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { extractAllInstallTargets } from './helpers/install-commands.js';

const configSchema = z.object({
  pairs: z.array(z.tuple([z.string(), z.string()])).optional(),
});

/**
 * Popular-name / typosquat pairs. Each entry is [real, squat].
 * Extend via rule options.pairs.
 */
const DEFAULT_TYPOSQUAT_PAIRS: Array<[string, string]> = [
  ['lodash', 'lodahs'],
  ['lodash', 'loadash'],
  ['react', 'reactt'],
  ['react', 'raect'],
  ['chalk', 'chaIk'],
  ['chalk', 'chalck'],
  ['express', 'expres'],
  ['axios', 'axioss'],
  ['dotenv', 'dotnev'],
  ['jsonwebtoken', 'jsonwebtokens'],
  ['requests', 'request'],
  ['numpy', 'numpyy'],
  ['pandas', 'pandass'],
  ['mcp-server-postgres', 'mcp-server-postgress'],
  ['github-mcp', 'github-mcp-v2'],
];

/**
 * security/package-typosquat-guard
 *
 * Warns when a package install command targets a name that looks like a
 * typosquat of a popular package. Works from a curated pair list rather
 * than edit-distance heuristics to minimise false positives. Maps to
 * OWASP LLM03 / Agentic ASI04 (Supply Chain).
 */
export const packageTyposquatGuard: Rule = {
  id: 'security/package-typosquat-guard',
  name: 'Package Typosquat Guard',
  description:
    'Warns when a package install targets a name resembling a typosquat of a popular package.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/package-typosquat-guard';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const pairs =
      (ruleConfig?.options?.pairs as Array<[string, string]>) ?? DEFAULT_TYPOSQUAT_PAIRS;

    const targets = extractAllInstallTargets(command);
    if (targets.length === 0) return { status: 'pass', ruleId };

    const hits: Array<{ squat: string; real: string }> = [];
    for (const pkg of targets) {
      const hit = pairs.find(([, squat]) => squat.toLowerCase() === pkg.toLowerCase());
      if (hit) hits.push({ squat: pkg, real: hit[0] });
    }

    if (hits.length === 0) return { status: 'pass', ruleId };

    const [first] = hits;
    return {
      status: 'warn',
      ruleId,
      message: `Package "${first?.squat}" resembles typosquat of "${first?.real}". ${hits.length > 1 ? `(${hits.length} hits total.)` : ''}`,
      fix: `Confirm the intended package name on the official registry. If you meant "${first?.real}", correct the install command. Typosquats are a documented supply-chain attack vector in 2026.`,
      metadata: { hits },
    };
  },
};
