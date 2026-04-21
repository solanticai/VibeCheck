import type { Rule, RuleResult } from '../../types.js';

/**
 * security/bun-no-unverified-install (bun preset)
 *
 * Blocks `bun install --trust <pkg>` (auto-runs lifecycle scripts without
 * review). The Shai-Hulud 2 (Nov 2025) supply-chain campaign specifically
 * targeted Bun's trust behaviour.
 */
export const bunNoUnverifiedInstall: Rule = {
  id: 'security/bun-no-unverified-install',
  name: 'Bun No Unverified Install',
  description: 'Blocks bun install --trust and similar unverified lifecycle-run flags.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },

  check: (context): RuleResult => {
    const ruleId = 'security/bun-no-unverified-install';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    if (/\bbun\s+(?:install|i|add)\s+[^\n]*--trust\b/.test(command)) {
      return {
        status: 'block',
        ruleId,
        message: 'bun install --trust runs lifecycle scripts for untrusted packages automatically.',
        fix: 'Run without --trust. Audit postinstall scripts manually for each dep that requires them.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
