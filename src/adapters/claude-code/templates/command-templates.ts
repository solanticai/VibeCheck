import type { ResolvedConfig } from '../../../types.js';
import { getAllRules } from '../../../engine/registry.js';
import { getAllPresets } from '../../../config/presets.js';

// ─── Static Command Templates ───────────────────────────────────────────────

const VGUARD_LINT = `Run VGuard lint to scan the project for rule violations.

Execute:
\`\`\`bash
npx vguard lint
\`\`\`

If violations are found:
1. Read the violation output carefully
2. For **block** severity — this must be fixed before the operation can proceed
3. For **warn** severity — should be fixed but won't block operations
4. For **info** severity — informational, no action required
5. Explain each violation and propose a fix

For machine-readable output: \`npx vguard lint --format json\`
For CI integration: \`npx vguard lint --format github-actions\`
`;

const VGUARD_DOCTOR = `Run VGuard doctor to check the health of the configuration and hooks.

Execute:
\`\`\`bash
npx vguard doctor
\`\`\`

Review each check result:
- **PASS** — healthy, no action needed
- **WARN** — should be addressed but not critical
- **FAIL** — must be fixed for VGuard to work correctly

If any checks fail:
1. Explain what each failure means
2. The most common fix is \`npx vguard generate\` to regenerate hooks
3. Offer to apply the fix

If all checks pass, confirm VGuard is healthy and properly configured.
`;

const VGUARD_REPORT = `Generate a VGuard quality dashboard from rule hit data.

Execute:
\`\`\`bash
npx vguard report
\`\`\`

After the report is generated:
1. Read the report output
2. Summarize key findings: total rule executions, most triggered rules, trends
3. Recommend specific actions to improve the quality score

If no data is available, explain that VGuard needs to run hooks during normal
development to collect analytics data. Suggest working normally with hooks enabled.
`;

const VGUARD_REMOVE = `Remove a VGuard rule or preset from the project configuration.

First, check the current configuration:
\`\`\`bash
npx vguard doctor
\`\`\`

This shows active rules and presets. Ask the user which to remove.

Once confirmed, execute:
- For a preset: \`npx vguard remove preset:<name>\`
- For a rule: \`npx vguard remove <category>/<rule-name>\`

After removing, regenerate hooks:
\`\`\`bash
npx vguard generate
\`\`\`

Confirm the change was applied.
`;

const VGUARD_FIX = `Auto-fix VGuard violations that have machine-applicable fixes.

First, preview what would be fixed:
\`\`\`bash
npx vguard fix --dry-run
\`\`\`

Show the user what fixes are available and ask for confirmation.

If confirmed, apply fixes:
\`\`\`bash
npx vguard fix
\`\`\`

After fixing:
1. Summarize what was changed
2. Run \`npx vguard lint\` to verify no remaining fixable issues
3. If issues remain without autofixes, explain them and propose manual fixes
`;

const VGUARD_LEARN = `Discover codebase conventions by scanning project source files.

Execute:
\`\`\`bash
npx vguard learn
\`\`\`

After the scan completes:
1. Review discovered patterns and their confidence levels
2. Highlight patterns marked as promotable to rules (indicated with +)
3. For each promotable pattern, explain what it does and whether to adopt it
4. If the user wants to promote patterns to rules, help add the suggested rules
   to \`vguard.config.ts\` and run \`npx vguard generate\`
`;

const VGUARD_STATUS = `Show the current VGuard configuration and active rules.

Execute these commands:
\`\`\`bash
npx vguard doctor
\`\`\`

Then read \`vguard.config.ts\` (or \`.vguardrc.json\`) to show the raw configuration.

Summarize:
- Which presets are active
- How many rules are enabled, grouped by category (security, quality, workflow)
- Which AI agents are configured
- Whether VGuard Cloud is connected
- The current VGuard version (check \`node_modules/@anthril/vguard/package.json\`)
`;

const VGUARD_UPGRADE = `Check for VGuard updates and apply them.

First, check what's available:
\`\`\`bash
npx vguard upgrade --check
\`\`\`

If updates are available:
1. Show the version change (current → latest)
2. Explain if it's a major, minor, or patch update
3. For major updates, warn about potential breaking changes
4. Ask the user if they want to proceed

If confirmed:
\`\`\`bash
npx vguard upgrade --apply
\`\`\`

After upgrading, regenerate hooks:
\`\`\`bash
npx vguard generate
\`\`\`
`;

// ─── Dynamic Command Builder ────────────────────────────────────────────────

function buildVGuardAdd(config: ResolvedConfig): string {
  const presets = getAllPresets();
  const rules = getAllRules();

  // Build preset list
  const presetLines = Array.from(presets.values())
    .map((p) => `- \`preset:${p.id}\` — ${p.description}`)
    .join('\n');

  // Build rule list grouped by category
  const rulesByCategory = new Map<string, string[]>();
  for (const [ruleId, rule] of rules) {
    const category = ruleId.split('/')[0];
    const existing = rulesByCategory.get(category) ?? [];
    existing.push(`- \`${ruleId}\` — ${rule.description}`);
    rulesByCategory.set(category, existing);
  }

  const ruleLines = Array.from(rulesByCategory.entries())
    .map(
      ([category, lines]) =>
        `**${category.charAt(0).toUpperCase() + category.slice(1)}:**\n${lines.join('\n')}`,
    )
    .join('\n\n');

  // Show which rules are already active
  const activeRuleIds = Array.from(config.rules.entries())
    .filter(([, rc]) => rc.enabled)
    .map(([id]) => id);

  const activeNote =
    activeRuleIds.length > 0
      ? `\n\n**Currently active rules (${activeRuleIds.length}):** ${activeRuleIds.join(', ')}`
      : '';

  return `Add a VGuard rule or preset to the project configuration.

Ask the user what they want to add.

## Available Presets

${presetLines}

## Available Rules

${ruleLines}
${activeNote}

## How to Add

For a preset:
\`\`\`bash
npx vguard add preset:<name>
\`\`\`

For a rule:
\`\`\`bash
npx vguard add <category>/<rule-name>
\`\`\`

After adding, regenerate hooks:
\`\`\`bash
npx vguard generate
\`\`\`

Confirm the change was applied.
`;
}

// ─── Exports ────────────────────────────────────────────────────────────────

/** Map of command name → template content */
export function getCommandTemplates(config: ResolvedConfig): Map<string, string> {
  const templates = new Map<string, string>();

  // Static commands
  templates.set('vguard-lint', VGUARD_LINT);
  templates.set('vguard-doctor', VGUARD_DOCTOR);
  templates.set('vguard-report', VGUARD_REPORT);
  templates.set('vguard-remove', VGUARD_REMOVE);
  templates.set('vguard-fix', VGUARD_FIX);
  templates.set('vguard-learn', VGUARD_LEARN);
  templates.set('vguard-status', VGUARD_STATUS);
  templates.set('vguard-upgrade', VGUARD_UPGRADE);

  // Dynamic commands (need config interpolation)
  templates.set('vguard-add', buildVGuardAdd(config));

  return templates;
}
