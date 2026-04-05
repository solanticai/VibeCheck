/**
 * Single source of truth for all VGuard CLI commands exposed as project scripts.
 *
 * This registry is used by:
 *  - {@link injectPackageJsonScripts} — to add `vguard:*` npm scripts to the user's
 *    project `package.json`.
 *  - {@link writeCommandsReference} — to generate `.vguard/COMMANDS.md`, a universal
 *    reference file that works for projects without a `package.json`.
 *
 * Keep this list in sync with the command definitions in `src/cli/index.ts`.
 */

export type CommandCategory = 'setup' | 'quality' | 'analysis' | 'maintenance' | 'cloud';

export interface VguardCommand {
  /** npm script key, e.g. `vguard:lint`. */
  scriptName: string;
  /** The shell invocation the script maps to, e.g. `vguard lint`. */
  cliInvocation: string;
  /** Human-readable description surfaced in COMMANDS.md. */
  description: string;
  /** Grouping used to organise the markdown reference file. */
  category: CommandCategory;
  /**
   * `true` when the command requires a positional argument.
   * Users invoke these via npm's `--` passthrough:
   *   `npm run vguard:add -- security/branch-protection`
   */
  acceptsArgs?: boolean;
  /** Optional hint surfaced next to the command in COMMANDS.md. */
  notes?: string;
}

export const VGUARD_COMMANDS: readonly VguardCommand[] = [
  // --- Setup -------------------------------------------------------------
  {
    scriptName: 'vguard',
    cliInvocation: 'vguard',
    description: 'Print help and the list of available VGuard commands.',
    category: 'setup',
  },
  {
    scriptName: 'vguard:init',
    cliInvocation: 'vguard init',
    description: 'Interactive setup wizard — configure VGuard for this project.',
    category: 'setup',
  },
  {
    scriptName: 'vguard:generate',
    cliInvocation: 'vguard generate',
    description:
      'Regenerate hook scripts, agent configs, and project scripts from vguard.config.ts.',
    category: 'setup',
  },
  {
    scriptName: 'vguard:doctor',
    cliInvocation: 'vguard doctor',
    description: 'Validate config, hook health, and performance budget.',
    category: 'setup',
  },

  // --- Quality -----------------------------------------------------------
  {
    scriptName: 'vguard:lint',
    cliInvocation: 'vguard lint',
    description: 'Run rules in static-analysis mode (CI-friendly).',
    category: 'quality',
    notes: 'Pass --format text|json|github-actions via `npm run vguard:lint -- --format json`.',
  },
  {
    scriptName: 'vguard:fix',
    cliInvocation: 'vguard fix',
    description: 'Auto-fix issues that have machine-applicable fixes.',
    category: 'quality',
    notes: 'Use --dry-run to preview fixes: `npm run vguard:fix -- --dry-run`.',
  },

  // --- Analysis ----------------------------------------------------------
  {
    scriptName: 'vguard:learn',
    cliInvocation: 'vguard learn',
    description: 'Scan the codebase for conventions and suggest new rules.',
    category: 'analysis',
  },
  {
    scriptName: 'vguard:report',
    cliInvocation: 'vguard report',
    description: 'Generate a quality dashboard from accumulated rule-hit data.',
    category: 'analysis',
  },

  // --- Maintenance -------------------------------------------------------
  {
    scriptName: 'vguard:add',
    cliInvocation: 'vguard add',
    description: 'Add a rule or preset to vguard.config.ts.',
    category: 'maintenance',
    acceptsArgs: true,
    notes: 'Example: `npm run vguard:add -- security/branch-protection`.',
  },
  {
    scriptName: 'vguard:remove',
    cliInvocation: 'vguard remove',
    description: 'Remove a rule or preset from vguard.config.ts.',
    category: 'maintenance',
    acceptsArgs: true,
    notes: 'Example: `npm run vguard:remove -- preset:nextjs-15`.',
  },
  {
    scriptName: 'vguard:upgrade',
    cliInvocation: 'vguard upgrade',
    description: 'Check for and apply updates to VGuard and plugins.',
    category: 'maintenance',
    notes: 'Pass --check or --apply: `npm run vguard:upgrade -- --check`.',
  },
  {
    scriptName: 'vguard:eject',
    cliInvocation: 'vguard eject',
    description: 'Export standalone hook scripts (removes the VGuard dependency).',
    category: 'maintenance',
    notes: 'Supports --adapter and --output flags via `--`.',
  },

  // --- Cloud -------------------------------------------------------------
  {
    scriptName: 'vguard:sync',
    cliInvocation: 'vguard sync',
    description: 'Upload rule-hit data and the config snapshot to VGuard Cloud.',
    category: 'cloud',
    notes: 'Pass --force or --dry-run: `npm run vguard:sync -- --dry-run`.',
  },
  {
    scriptName: 'vguard:cloud:login',
    cliInvocation: 'vguard cloud login',
    description: 'Authenticate with VGuard Cloud (opens browser by default).',
    category: 'cloud',
  },
  {
    scriptName: 'vguard:cloud:logout',
    cliInvocation: 'vguard cloud logout',
    description: 'Remove stored Cloud credentials from this machine.',
    category: 'cloud',
  },
  {
    scriptName: 'vguard:cloud:connect',
    cliInvocation: 'vguard cloud connect',
    description: 'Register the current repository with VGuard Cloud.',
    category: 'cloud',
  },
  {
    scriptName: 'vguard:cloud:status',
    cliInvocation: 'vguard cloud status',
    description: 'Show the current VGuard Cloud connection status.',
    category: 'cloud',
  },
] as const;

/**
 * Human-readable labels for each category, used as section headings in
 * `.vguard/COMMANDS.md`.
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  setup: 'Setup & Configuration',
  quality: 'Quality Checks',
  analysis: 'Analysis & Reporting',
  maintenance: 'Rules & Maintenance',
  cloud: 'VGuard Cloud',
};

/**
 * The canonical ordering of categories in generated output.
 */
export const CATEGORY_ORDER: readonly CommandCategory[] = [
  'setup',
  'quality',
  'analysis',
  'maintenance',
  'cloud',
] as const;

/**
 * Group commands by their category while preserving registry order within each group.
 */
export function getCommandsByCategory(): Record<CommandCategory, VguardCommand[]> {
  const grouped: Record<CommandCategory, VguardCommand[]> = {
    setup: [],
    quality: [],
    analysis: [],
    maintenance: [],
    cloud: [],
  };
  for (const cmd of VGUARD_COMMANDS) {
    grouped[cmd.category].push(cmd);
  }
  return grouped;
}

/**
 * Build a flat `{ scriptName: cliInvocation }` record for package.json injection.
 */
export function buildScriptsRecord(): Record<string, string> {
  const scripts: Record<string, string> = {};
  for (const cmd of VGUARD_COMMANDS) {
    scripts[cmd.scriptName] = cmd.cliInvocation;
  }
  return scripts;
}
