import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';

import { formatVersion } from './build-info.js';
import { handleFatal } from './ui/errors.js';
import { setAsciiMode, setDebugMode, setVerbosity } from './ui/env.js';
import { EXIT } from './exit-codes.js';

// Commander's `.choices()` signature expects a mutable `string[]`, so these
// lists are declared as plain arrays rather than `as const` tuples — that
// way we don't need the `as unknown as string[]` double cast at the call
// sites. The exported union types below keep the rest of the codebase
// type-safe against the canonical values.
const LINT_FORMATS: string[] = ['text', 'json', 'github-actions', 'ndjson'];
const REPORT_FORMATS: string[] = ['md', 'json', 'html', 'all'];
const SHELL_CHOICES: string[] = ['bash', 'zsh', 'fish', 'powershell'];

export type LintFormat = 'text' | 'json' | 'github-actions' | 'ndjson';
export type ReportFormat = 'md' | 'json' | 'html' | 'all';
export type ShellChoice = 'bash' | 'zsh' | 'fish' | 'powershell';

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function showHelpAction(this: Command): void {
  this.outputHelp();
}

const program = new Command();

program
  .name('vguard')
  .description('AI coding guardrails framework. Runtime-enforced quality controls.')
  .version(`vguard ${formatVersion()}`, '-V, --version', 'Output the VGuard version and build info')
  .option('--debug', 'Show full stack traces on error (same as DEBUG=vguard*)')
  .option('--ascii', 'Force ASCII output (no unicode glyphs or colour)')
  .option('--no-color', 'Disable colour output (same as NO_COLOR=1)')
  .option(
    '-q, --quiet',
    'Suppress banners and progress output (machine output still reaches stdout)',
  )
  .option('--verbose', 'Print extra diagnostic detail to stderr')
  .showHelpAfterError('(run `vguard --help` for usage)')
  .showSuggestionAfterError(true)
  .configureHelp({
    helpWidth: process.stdout.columns && process.stdout.columns > 40 ? process.stdout.columns : 80,
    sortSubcommands: false,
  });

program.hook('preAction', (thisCommand, actionCommand) => {
  const rootOpts = thisCommand.opts();
  if (rootOpts.ascii) setAsciiMode(true);
  if (rootOpts.debug) setDebugMode(true);
  if (rootOpts.color === false) process.env.NO_COLOR = '1';
  if (rootOpts.quiet && rootOpts.verbose) {
    throw new InvalidArgumentError('--quiet and --verbose are mutually exclusive. Pick one.');
  }
  if (rootOpts.quiet) setVerbosity('quiet');
  if (rootOpts.verbose) setVerbosity('verbose');
  // Silence helper used but not reassigned; keep reference to avoid unused-var
  void actionCommand;
});

program
  .command('init')
  .description('Interactive setup wizard - configure VGuard for your project')
  .option('-f, --force', 'Reconfigure from scratch, overwriting existing config')
  .option('-y, --yes', 'Run non-interactively, accepting defaults + supplied flags')
  .option(
    '-p, --preset <id>',
    'Enable a preset (repeatable). Use --yes for non-interactive setup.',
    collect,
    [] as string[],
  )
  .option(
    '-a, --agent <id>',
    'Target AI agent (repeatable). Valid: claude-code, cursor, codex, opencode.',
    collect,
    [] as string[],
  )
  .option(
    '-b, --protected-branches <list>',
    'Comma-separated list of protected branches (default: "main, master")',
  )
  .option('--cloud', 'Enable VGuard Cloud telemetry in the generated config')
  .option('--no-cloud', 'Skip the Cloud prompt and leave Cloud disabled')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard init                                            Interactive setup
  $ vguard init --yes                                      Accept defaults (CI-safe)
  $ vguard init --yes -p nextjs-15 -a claude-code          Scripted setup
  $ vguard init --force --yes                              Overwrite existing config
`,
  )
  .action(async (options) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(options);
  });

program
  .command('add [id]')
  .description('Add a rule or preset (e.g., vguard add security/branch-protection)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard add security/branch-protection         Add a rule by id
  $ vguard add preset:nextjs-15                   Add a preset by id
  $ vguard rules list --all                       Discover rule ids
  $ vguard presets list                           Discover preset ids
`,
  )
  .action(async (id: string | undefined) => {
    const { addCommand } = await import('./commands/add.js');
    await addCommand(id);
  });

program
  .command('remove [id]')
  .description('Remove a rule or preset (e.g., vguard remove preset:nextjs-15)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard remove security/branch-protection      Remove a rule by id
  $ vguard remove preset:nextjs-15                Remove a preset by id
  $ vguard rules list                             Discover enabled rule ids
`,
  )
  .action(async (id: string | undefined) => {
    const { removeCommand } = await import('./commands/remove.js');
    await removeCommand(id);
  });

program
  .command('generate')
  .description('Regenerate hook scripts and agent configs from current config')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard generate
`,
  )
  .action(async () => {
    const { generateCommand } = await import('./commands/generate.js');
    await generateCommand();
  });

program
  .command('doctor')
  .description('Validate config and hook health (exits non-zero on failure)')
  .option('-j, --json', 'Emit check results as JSON (stable schema, for CI)')
  .option('--strict', 'Treat warnings as failures (exit 78 when any check warns)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard doctor                    Run all checks, exit 78 on fail
  $ vguard doctor --strict           Treat warnings as failures (CI-friendly)
  $ vguard doctor --json | jq .      Parse results programmatically
  $ vguard doctor --ascii            ASCII-only output for legacy terminals
`,
  )
  .action(async (options: { json?: boolean; strict?: boolean }) => {
    const { doctorCommand } = await import('./commands/doctor.js');
    await doctorCommand(options);
  });

program
  .command('install-hooks')
  .description('Install native git pre-commit and commit-msg hooks (replaces husky)')
  .option('--uninstall', 'Remove VGuard-managed git hooks')
  .option('--silent', 'Suppress informational output (used by npm postinstall)')
  .option('--force', 'Overwrite existing non-vguard git hooks')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard install-hooks              Install pre-commit + commit-msg hooks
  $ vguard install-hooks --uninstall  Remove VGuard-managed hooks
  $ VGUARD_NO_INSTALL_HOOKS=1 npm i   Skip auto-install at npm install time
  $ VGUARD_SKIP_HOOKS=1 git commit    Bypass hooks for one commit
`,
  )
  .action(async (options: { uninstall?: boolean; silent?: boolean; force?: boolean }) => {
    const { installHooksCommand } = await import('./commands/install-hooks.js');
    await installHooksCommand(options);
  });

// Hidden subcommand invoked by the generated .git/hooks/* scripts. Not shown
// in `vguard --help` because it's an internal dispatcher, not user-facing.
program
  .command('_run-git-hook <event> [msgFile]', { hidden: true })
  .action(async (event: string, msgFile: string | undefined) => {
    if (event !== 'git:pre-commit' && event !== 'git:commit-msg') {
      process.exit(0);
    }
    const { runGitHook } = await import('../engine/git-hook-runner.js');
    await runGitHook(event, msgFile ? { commitMessageFile: msgFile } : {});
  });

program
  .command('lint')
  .description('Run rules in static analysis mode (CI-friendly)')
  .addOption(
    new Option('-f, --format <format>', 'Output format').choices(LINT_FORMATS).default('text'),
  )
  .addHelpText(
    'after',
    `
Examples:
  $ vguard lint                              Human-readable lint output
  $ vguard lint --format json | jq .         Machine-readable JSON
  $ vguard lint --format ndjson | jq -c .    Streaming NDJSON
  $ vguard lint --format github-actions      Annotations for GitHub PR UI
`,
  )
  .action(async (options: { format?: string }) => {
    const { lintCommand } = await import('./commands/lint.js');
    await lintCommand(options);
  });

program
  .command('learn')
  .description('Scan codebase for conventions and suggest rules')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard learn
`,
  )
  .action(async () => {
    const { learnCommand } = await import('./commands/learn.js');
    await learnCommand();
  });

program
  .command('version')
  .description('Display the installed VGuard CLI version')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard version
`,
  )
  .action(async () => {
    const { versionCommand } = await import('./commands/version.js');
    versionCommand();
  });

program
  .command('report')
  .description('Generate quality dashboard from rule hit data')
  .option('-o, --output <path>', 'Save report to a specific file path')
  .addOption(
    new Option('-f, --format <format>', 'Output format').choices(REPORT_FORMATS).default('md'),
  )
  .addHelpText(
    'after',
    `
Examples:
  $ vguard report                             Markdown at .vguard/reports/...
  $ vguard report --format json -o out.json   JSON to a file
  $ vguard report --format html               Self-contained HTML dashboard
  $ vguard report --format all                Write md + json + html
`,
  )
  .action(async (options: { output?: string; format?: string }) => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand(options);
  });

program
  .command('dashboard')
  .description('Start a local live dashboard that tails rule-hits.jsonl')
  .option('-p, --port <port>', 'Port to bind', (v) => parseInt(v, 10), 7322)
  .option('-H, --host <host>', 'Bind host', '127.0.0.1')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard dashboard                             Open http://127.0.0.1:7322
  $ vguard dashboard --port 8080                 Use a custom port
  $ vguard dashboard --host 0.0.0.0              Bind on all interfaces (LAN-reachable)
`,
  )
  .action(async (options: { port?: number; host?: string }) => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand(options);
  });

program
  .command('drift')
  .description('Measure convention drift vs .vguard/baseline.json (freeze with --freeze)')
  .option('--freeze', 'Freeze current conventions as the baseline')
  .option('--threshold <pct>', 'Exit non-zero if drift % exceeds this', (v) => parseFloat(v))
  .option('--format <fmt>', 'Output format (text|json)', 'text')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard drift --freeze                        Capture baseline (run once)
  $ vguard drift                                 Measure drift vs baseline
  $ vguard drift --threshold 15                  CI-friendly (exit non-zero if > 15%)
  $ vguard drift --format json | jq .            Machine-readable output
`,
  )
  .action(async (options: { freeze?: boolean; threshold?: number; format?: string }) => {
    const { driftCommand } = await import('./commands/drift.js');
    await driftCommand(options);
  });

const webhookCmd = program
  .command('webhook')
  .description('HTTP webhook adapter for language-agnostic agents')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard webhook serve                          Serve on http://127.0.0.1:7321
  $ vguard webhook serve --port 8080              Use a custom port
  $ vguard webhook spec                           Write OpenAPI spec to .vguard/webhook/openapi.json
  $ vguard webhook spec -o ./openapi.json         Write to a custom path
`,
  );

webhookCmd
  .command('serve')
  .description('Start a local HTTP server that evaluates VGuard rules against JSON payloads')
  .option('-p, --port <port>', 'Port to bind', (v) => parseInt(v, 10), 7321)
  .option('-H, --host <host>', 'Bind host', '127.0.0.1')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard webhook serve                          Default: 127.0.0.1:7321
  $ vguard webhook serve --port 8080              Custom port
  $ vguard webhook serve --host 0.0.0.0           Bind all interfaces
  $ curl -X POST http://127.0.0.1:7321/hook/PreToolUse \\
      -H 'content-type: application/json' \\
      -d '{"tool":"Bash","toolInput":{"command":"ls"}}'
`,
  )
  .action(async (options: { port?: number; host?: string }) => {
    const { webhookServeCommand } = await import('./commands/webhook.js');
    await webhookServeCommand(options);
  });

webhookCmd
  .command('spec')
  .description('Write the OpenAPI 3.0.3 spec for the webhook endpoint')
  .option('-o, --output <path>', 'Output path', '.vguard/webhook/openapi.json')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard webhook spec                           Default: .vguard/webhook/openapi.json
  $ vguard webhook spec -o ./openapi.json         Custom output path
  $ vguard webhook spec -o - > spec.json          (future: stdout support)
`,
  )
  .action(async (options: { output?: string }) => {
    const { webhookSpecCommand } = await import('./commands/webhook.js');
    await webhookSpecCommand(options);
  });

program
  .command('eject')
  .description('Export standalone hooks (removes VGuard dependency)')
  .option('--adapter <adapter>', 'Target adapter', 'claude-code')
  .option('-o, --output <dir>', 'Output directory', '.vguard/ejected')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard eject                              Default adapter = claude-code
  $ vguard eject --adapter claude-code -o ejected/
`,
  )
  .action(async (options: { adapter?: string; output?: string }) => {
    const { ejectCommand } = await import('./commands/eject.js');
    await ejectCommand(options);
  });

program
  .command('upgrade')
  .description('Check for and apply updates to VGuard and plugins')
  .option('--check', 'Only check for updates, do not apply')
  .option('--apply', 'Apply available updates')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard upgrade --check       List available updates
  $ vguard upgrade --apply       Install available updates
`,
  )
  .action(async (options: { check?: boolean; apply?: boolean }) => {
    if (options.check && options.apply) {
      throw new InvalidArgumentError('--check and --apply are mutually exclusive. Pick one.');
    }
    const { upgradeCommand } = await import('./commands/upgrade.js');
    await upgradeCommand(options);
  });

program
  .command('fix')
  .description('Auto-fix issues that have machine-applicable fixes')
  .option('-n, --dry-run', 'Show fixes without applying them')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard fix
  $ vguard fix --dry-run
`,
  )
  .action(async (options: { dryRun?: boolean }) => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand(options);
  });

const rules = program
  .command('rules')
  .description('Manage rules (list, enable, disable)')
  .action(showHelpAction);

rules
  .command('list')
  .description('List rules, their severity, and enabled status')
  .option('-a, --all', 'Include disabled rules')
  .option('-j, --json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard rules list
  $ vguard rules list --all
  $ vguard rules list --json | jq '.[] | select(.severity=="block") | .id'
`,
  )
  .action(async (options: { all?: boolean; json?: boolean }) => {
    const { rulesListCommand } = await import('./commands/rules.js');
    await rulesListCommand(options);
  });

rules
  .command('enable <rule>')
  .description('Enable a specific rule by its ID')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard rules enable security/branch-protection
`,
  )
  .action(async (ruleId: string) => {
    const { rulesEnableCommand } = await import('./commands/rules.js');
    await rulesEnableCommand(ruleId);
  });

rules
  .command('disable <rule>')
  .description('Disable a specific rule by its ID')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard rules disable quality/no-god-files
`,
  )
  .action(async (ruleId: string) => {
    const { rulesDisableCommand } = await import('./commands/rules.js');
    await rulesDisableCommand(ruleId);
  });

const presets = program
  .command('presets')
  .description('Manage presets (list, add, remove)')
  .action(showHelpAction);

presets
  .command('list')
  .description('List available presets and their status')
  .option('--installed', 'Show only installed presets')
  .option('-j, --json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard presets list
  $ vguard presets list --installed
  $ vguard presets list --json | jq '.[].id'
`,
  )
  .action(async (options: { installed?: boolean; json?: boolean }) => {
    const { presetsListCommand } = await import('./commands/presets.js');
    await presetsListCommand(options);
  });

presets
  .command('add <preset>')
  .description('Add and activate a preset')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard presets add nextjs-15
`,
  )
  .action(async (presetId: string) => {
    const { presetsAddCommand } = await import('./commands/presets.js');
    await presetsAddCommand(presetId);
  });

presets
  .command('remove <preset>')
  .description('Remove a preset from the active configuration')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard presets remove nextjs-15
`,
  )
  .action(async (presetId: string) => {
    const { presetsRemoveCommand } = await import('./commands/presets.js');
    await presetsRemoveCommand(presetId);
  });

const skills = program
  .command('skills')
  .description('Manage VGuard companion skills (list, install, add, remove)')
  .action(showHelpAction);

skills
  .command('list')
  .description('List every companion skill bundled with VGuard')
  .option('-j, --json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    // Intentionally synchronous — skillsListCommand calls process.exit.
    import('./commands/skills.js').then((m) => m.skillsListCommand(options));
  });

skills
  .command('install')
  .description('Install companion skills into the configured agent directories')
  .option(
    '--agent <name>',
    'Install into a single agent only (claude-code | cursor | codex | opencode | all)',
  )
  .option(
    '--skills <ids>',
    'Non-interactive: comma-separated skill ids, "all", or "none"',
  )
  .option('--yes', 'Skip the interactive prompt and install every bundled skill')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard skills install                     Interactive checkbox prompt
  $ vguard skills install --yes               Install every bundled skill
  $ vguard skills install --skills=setup-vguard,troubleshoot
  $ vguard skills install --skills=none       Skip (useful in CI)
  $ vguard skills install --agent claude-code Scope to a single agent
`,
  )
  .action(
    async (options: {
      agent?: 'claude-code' | 'cursor' | 'codex' | 'opencode' | 'all';
      skills?: string;
      yes?: boolean;
    }) => {
      const { skillsInstallCommand } = await import('./commands/skills.js');
      await skillsInstallCommand(options);
    },
  );

skills
  .command('add <ids...>')
  .description('Non-interactive install of one or more skills by id')
  .option('--agent <name>', 'Install into a single agent only')
  .action(
    async (
      ids: string[],
      options: { agent?: 'claude-code' | 'cursor' | 'codex' | 'opencode' | 'all' },
    ) => {
      const { skillsAddCommand } = await import('./commands/skills.js');
      await skillsAddCommand(ids, options);
    },
  );

skills
  .command('remove <ids...>')
  .description('Remove one or more installed skills from every configured agent')
  .option('--agent <name>', 'Remove from a single agent only')
  .action(
    async (
      ids: string[],
      options: { agent?: 'claude-code' | 'cursor' | 'codex' | 'opencode' | 'all' },
    ) => {
      const { skillsRemoveCommand } = await import('./commands/skills.js');
      await skillsRemoveCommand(ids, options);
    },
  );

const config = program
  .command('config')
  .description('View and modify VGuard configuration')
  .action(showHelpAction);

config
  .command('show')
  .description('Display the fully resolved configuration')
  .option('-j, --json', 'Output as JSON')
  .option('--raw', 'Show raw config without preset resolution')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard config show
  $ vguard config show --raw
  $ vguard config show --json | jq .rules
`,
  )
  .action(async (options: { json?: boolean; raw?: boolean }) => {
    const { configShowCommand } = await import('./commands/config.js');
    await configShowCommand(options);
  });

config
  .command('set <key> <value>')
  .description('Set a configuration option (supports dot-notation for nested keys)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard config set cloud.autoSync false
`,
  )
  .action(async (key: string, value: string) => {
    const { configSetCommand } = await import('./commands/config.js');
    await configSetCommand(key, value);
  });

const cloud = program
  .command('cloud')
  .description('VGuard Cloud commands (login, connect, status)')
  .action(showHelpAction);

cloud
  .command('login')
  .description('Authenticate with VGuard Cloud (opens browser by default)')
  .option('--token <token>', 'Manual token login for CI/headless (skip browser)')
  .option('--refresh-token <token>', 'Supabase refresh token (with --token)')
  .option('--url <url>', 'Cloud API URL (e.g. http://localhost:3000)')
  .option('--supabase-url <url>', 'Supabase project URL')
  .option('--supabase-anon-key <key>', 'Supabase anon key')
  .option('--no-interactive', 'Print manual login URL instead of opening browser')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard cloud login                              Interactive browser login
  $ vguard cloud login --token $VGUARD_TOKEN        CI/headless login
  $ vguard cloud login --no-interactive             Print login URL, do not open
`,
  )
  .action(
    async (options: {
      token?: string;
      refreshToken?: string;
      url?: string;
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      noInteractive?: boolean;
    }) => {
      const { cloudLoginCommand } = await import('./commands/cloud-login.js');
      await cloudLoginCommand(options);
    },
  );

cloud
  .command('logout')
  .description('Remove stored Cloud credentials')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard cloud logout
`,
  )
  .action(async () => {
    const { cloudLogoutCommand } = await import('./commands/cloud-logout.js');
    await cloudLogoutCommand();
  });

cloud
  .command('connect')
  .description('Register current repository with VGuard Cloud')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .option('--key <key>', 'Use an existing project API key (requires --project-id)')
  .option('--project-id <id>', 'Project ID (required with --key)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard cloud connect                                      Auto-name from directory
  $ vguard cloud connect --name my-app                        Custom project name
  $ vguard cloud connect --key vc_abc --project-id proj_123   Skip login, use existing key
`,
  )
  .action(async (options: { name?: string; key?: string; projectId?: string }) => {
    const { cloudConnectCommand } = await import('./commands/cloud-connect.js');
    await cloudConnectCommand(options);
  });

cloud
  .command('status')
  .description('Show Cloud connection status')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard cloud status
`,
  )
  .action(async () => {
    const { cloudStatusCommand } = await import('./commands/cloud-status.js');
    await cloudStatusCommand();
  });

program
  .command('sync')
  .description('Upload rule-hits data to VGuard Cloud')
  .option('-f, --force', 'Re-upload all data (ignores cursor)')
  .option('-n, --dry-run', 'Show what would be uploaded without sending')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard sync                 Upload new rule-hits since last sync
  $ vguard sync --dry-run       Preview what would be uploaded
  $ vguard sync --force         Re-upload everything
`,
  )
  .action(async (options: { force?: boolean; dryRun?: boolean }) => {
    const { syncCommand } = await import('./commands/sync.js');
    await syncCommand(options);
  });

const ignore = program
  .command('ignore')
  .description('Manage .vguardignore (exclude files from rules, hooks, and scans)')
  .action(showHelpAction);

ignore
  .command('list')
  .description('List all active ignore patterns, grouped by source')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard ignore list
`,
  )
  .action(async () => {
    const { ignoreListCommand } = await import('./commands/ignore.js');
    ignoreListCommand();
  });

ignore
  .command('add <pattern>')
  .description('Append a pattern to .vguardignore (creates it if missing)')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard ignore add "build-artifacts/**"
  $ vguard ignore add "*.generated.ts"
`,
  )
  .action(async (pattern: string) => {
    const { ignoreAddCommand } = await import('./commands/ignore.js');
    await ignoreAddCommand(pattern);
  });

ignore
  .command('remove <pattern>')
  .description('Remove an exact pattern from .vguardignore')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard ignore remove "build-artifacts/**"
`,
  )
  .action(async (pattern: string) => {
    const { ignoreRemoveCommand } = await import('./commands/ignore.js');
    await ignoreRemoveCommand(pattern);
  });

ignore
  .command('check <path>')
  .description('Print whether a path is ignored and which source matched')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard ignore check src/foo.ts
`,
  )
  .action(async (path: string) => {
    const { ignoreCheckCommand } = await import('./commands/ignore.js');
    ignoreCheckCommand(path);
  });

ignore
  .command('init')
  .description('Create a .vguardignore with the default template')
  .addHelpText(
    'after',
    `
Examples:
  $ vguard ignore init
`,
  )
  .action(async () => {
    const { ignoreInitCommand } = await import('./commands/ignore.js');
    await ignoreInitCommand();
  });

program
  .command('completion <shell>')
  .description(`Print a shell completion script (${SHELL_CHOICES.join(', ')})`)
  .addHelpText(
    'after',
    `
Examples:
  $ vguard completion bash >> ~/.bashrc
  $ vguard completion zsh  > "\${fpath[1]}/_vguard"
  $ vguard completion fish > ~/.config/fish/completions/vguard.fish
  $ vguard completion powershell >> $PROFILE
`,
  )
  .action(async (shell: string) => {
    const { completionCommand } = await import('./commands/completion.js');
    completionCommand(shell);
  });

program.addHelpText(
  'after',
  `
Run \`vguard <command> --help\` to see command-specific usage and examples.
Docs: https://vguard.dev     Issues: https://github.com/anthril/vibe-guard/issues
`,
);

function propagateExitOverride(cmd: Command): void {
  cmd.exitOverride((err) => {
    throw err;
  });
  for (const sub of cmd.commands) {
    propagateExitOverride(sub);
  }
}
propagateExitOverride(program);

async function main(): Promise<void> {
  // Pre-scan argv so flags raised during parsing respect user intent.
  if (process.argv.includes('--debug')) setDebugMode(true);
  if (process.argv.includes('--ascii')) setAsciiMode(true);
  if (process.argv.includes('--quiet') || process.argv.includes('-q')) setVerbosity('quiet');
  if (process.argv.includes('--verbose')) setVerbosity('verbose');

  process.once('SIGINT', () => {
    process.stderr.write('\n');
    process.exit(EXIT.SIGINT);
  });

  if (process.argv.length <= 2 && process.stdout.isTTY) {
    try {
      const { discoverConfigFile } = await import('../config/discovery.js');
      if (!discoverConfigFile(process.cwd())) {
        program.outputHelp();
        process.stderr.write(
          "\n  VGuard isn't configured in this directory yet — run `vguard init` to get started.\n",
        );
        process.exit(EXIT.OK);
      }
    } catch {
      // Fall through on any error — never block help.
    }
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Commander's help-invocation throws a synthetic error that we should
    // treat as a clean exit. We duck-type (instanceof is unreliable when
    // dependency de-duplication misses, e.g. inside tsup bundles).
    const commanderErr = err as { code?: string; exitCode?: number } | undefined;
    if (
      err instanceof CommanderError ||
      (commanderErr &&
        typeof commanderErr.code === 'string' &&
        commanderErr.code.startsWith('commander.'))
    ) {
      const code = commanderErr?.code ?? '';
      if (
        code === 'commander.helpDisplayed' ||
        code === 'commander.version' ||
        code === 'commander.help'
      ) {
        process.exit(EXIT.OK);
      }
      if ((commanderErr?.exitCode ?? 1) !== 0) {
        process.exit(EXIT.USAGE);
      }
      process.exit(EXIT.OK);
    }
    handleFatal(err);
  }
}

main();
