import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { parseSingleInstallCommand } from './helpers/install-commands.js';

const configSchema = z.object({
  allowScopedPrefixes: z.array(z.string()).optional(),
  blocklist: z.array(z.string()).optional(),
  networkCheck: z.boolean().optional(),
});

const DEFAULT_ALLOW_SCOPED_PREFIXES = ['@types/'];

/**
 * Known-hallucinated / repeatedly-squatted names. Extend via rule options.blocklist.
 * Sources: Socket, Aikido, BleepingComputer 2025-2026 slopsquatting reports.
 */
const KNOWN_HALLUCINATED_NAMES = new Set<string>([
  'huggingface-cli',
  'react-codeshift',
  'chalk-utils',
  'mcp-server-postgress',
  'github-mcp-v2',
]);

/**
 * security/package-hallucination-guard
 *
 * Blocks `npm|pnpm|yarn|pip|uv|poetry install` commands that reference
 * known-hallucinated / slopsquatted package names. USENIX Security 2025
 * measured ~20% hallucination rate across 16 models, with 43–58%
 * recurrence — making pre-registration economically viable for attackers.
 * Maps to OWASP LLM03 and Agentic ASI04.
 */
export const packageHallucinationGuard: Rule = {
  id: 'security/package-hallucination-guard',
  name: 'Package Hallucination Guard',
  description:
    'Blocks npm/pip/uv/pnpm/yarn install commands that reference known-hallucinated package names.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/package-hallucination-guard';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const allowScoped =
      (ruleConfig?.options?.allowScopedPrefixes as string[]) ?? DEFAULT_ALLOW_SCOPED_PREFIXES;
    const extraBlocked = new Set<string>((ruleConfig?.options?.blocklist as string[]) ?? []);

    const parsed = parseSingleInstallCommand(command);
    if (!parsed || parsed.packages.length === 0) return { status: 'pass', ruleId };

    const hits: string[] = [];
    for (const pkg of parsed.packages) {
      if (allowScoped.some((p) => pkg.startsWith(p))) continue;
      if (KNOWN_HALLUCINATED_NAMES.has(pkg) || extraBlocked.has(pkg)) {
        hits.push(pkg);
      }
    }

    if (hits.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `Refusing to install known-hallucinated / slopsquatted package(s): ${hits.join(', ')}.`,
      fix: 'Verify the intended package name on the official registry (npmjs.com, pypi.org). AI agents frequently invent package names — a hallucinated name is often pre-registered by an attacker.',
      metadata: { manager: parsed.manager, packages: hits },
    };
  },
};
