import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('vguard')
  .description('AI coding guardrails framework. Runtime-enforced quality controls.')
  .version(getVersion());

program
  .command('init')
  .description('Interactive setup wizard — configure VGuard for your project')
  .action(async () => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand();
  });

program
  .command('add <id>')
  .description('Add a rule or preset (e.g., vguard add security/branch-protection)')
  .action(async (id: string) => {
    const { addCommand } = await import('./commands/add.js');
    await addCommand(id);
  });

program
  .command('remove <id>')
  .description('Remove a rule or preset (e.g., vguard remove preset:nextjs-15)')
  .action(async (id: string) => {
    const { removeCommand } = await import('./commands/remove.js');
    await removeCommand(id);
  });

program
  .command('generate')
  .description('Regenerate hook scripts and agent configs from current config')
  .action(async () => {
    const { generateCommand } = await import('./commands/generate.js');
    await generateCommand();
  });

program
  .command('doctor')
  .description('Validate config and hook health')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor.js');
    await doctorCommand();
  });

program
  .command('lint')
  .description('Run rules in static analysis mode (CI-friendly)')
  .option('--format <format>', 'Output format: text, json, github-actions', 'text')
  .action(async (options: { format?: string }) => {
    const { lintCommand } = await import('./commands/lint.js');
    await lintCommand(options);
  });

program
  .command('learn')
  .description('Scan codebase for conventions and suggest rules')
  .action(async () => {
    const { learnCommand } = await import('./commands/learn.js');
    await learnCommand();
  });

program
  .command('version')
  .description('Display the installed VGuard CLI version')
  .action(async () => {
    const { versionCommand } = await import('./commands/version.js');
    versionCommand();
  });

program
  .command('report')
  .description('Generate quality dashboard from rule hit data')
  .option('--output <path>', 'Save report to a specific file path')
  .option('--format <format>', 'Output format: md or json (default: md)', 'md')
  .action(async (options: { output?: string; format?: string }) => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand(options);
  });

program
  .command('eject')
  .description('Export standalone hooks (removes VGuard dependency)')
  .option('--adapter <adapter>', 'Target adapter (default: claude-code)', 'claude-code')
  .option('--output <dir>', 'Output directory (default: .vguard/ejected)')
  .action(async (options: { adapter?: string; output?: string }) => {
    const { ejectCommand } = await import('./commands/eject.js');
    await ejectCommand(options);
  });

program
  .command('upgrade')
  .description('Check for and apply updates to VGuard and plugins')
  .option('--check', 'Only check for updates, do not apply')
  .option('--apply', 'Apply available updates')
  .action(async (options: { check?: boolean; apply?: boolean }) => {
    const { upgradeCommand } = await import('./commands/upgrade.js');
    await upgradeCommand(options);
  });

program
  .command('fix')
  .description('Auto-fix issues that have machine-applicable fixes')
  .option('--dry-run', 'Show fixes without applying them')
  .action(async (options: { dryRun?: boolean }) => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand(options);
  });

// Rules subcommands
const rules = program
  .command('rules')
  .description('Manage rules (list, enable, disable)');

rules
  .command('list')
  .description('List rules, their severity, and enabled status')
  .option('--all', 'Include disabled rules')
  .option('--json', 'Output as JSON')
  .action(async (options: { all?: boolean; json?: boolean }) => {
    const { rulesListCommand } = await import('./commands/rules.js');
    await rulesListCommand(options);
  });

rules
  .command('enable <rule>')
  .description('Enable a specific rule by its ID')
  .action(async (ruleId: string) => {
    const { rulesEnableCommand } = await import('./commands/rules.js');
    await rulesEnableCommand(ruleId);
  });

rules
  .command('disable <rule>')
  .description('Disable a specific rule by its ID')
  .action(async (ruleId: string) => {
    const { rulesDisableCommand } = await import('./commands/rules.js');
    await rulesDisableCommand(ruleId);
  });

// Presets subcommands
const presets = program
  .command('presets')
  .description('Manage presets (list, add, remove)');

presets
  .command('list')
  .description('List available presets and their status')
  .option('--installed', 'Show only installed presets')
  .action(async (options: { installed?: boolean }) => {
    const { presetsListCommand } = await import('./commands/presets.js');
    await presetsListCommand(options);
  });

presets
  .command('add <preset>')
  .description('Add and activate a preset')
  .action(async (presetId: string) => {
    const { presetsAddCommand } = await import('./commands/presets.js');
    await presetsAddCommand(presetId);
  });

presets
  .command('remove <preset>')
  .description('Remove a preset from the active configuration')
  .action(async (presetId: string) => {
    const { presetsRemoveCommand } = await import('./commands/presets.js');
    await presetsRemoveCommand(presetId);
  });

// Config subcommands
const config = program
  .command('config')
  .description('View and modify VGuard configuration');

config
  .command('show')
  .description('Display the fully resolved configuration')
  .option('--json', 'Output as JSON')
  .option('--raw', 'Show raw config without preset resolution')
  .action(async (options: { json?: boolean; raw?: boolean }) => {
    const { configShowCommand } = await import('./commands/config.js');
    await configShowCommand(options);
  });

config
  .command('set <key> <value>')
  .description('Set a configuration option (supports dot-notation for nested keys)')
  .action(async (key: string, value: string) => {
    const { configSetCommand } = await import('./commands/config.js');
    await configSetCommand(key, value);
  });

// Cloud subcommands
const cloud = program
  .command('cloud')
  .description('VGuard Cloud commands (login, connect, status)');

cloud
  .command('login')
  .description('Authenticate with VGuard Cloud (opens browser by default)')
  .option('--token <token>', 'Manual token login for CI/headless (skip browser)')
  .option('--refresh-token <token>', 'Supabase refresh token (with --token)')
  .option('--url <url>', 'Cloud API URL (e.g. http://localhost:3000)')
  .option('--supabase-url <url>', 'Supabase project URL')
  .option('--supabase-anon-key <key>', 'Supabase anon key')
  .option('--no-interactive', 'Print manual login URL instead of opening browser')
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
  .action(async () => {
    const { cloudLogoutCommand } = await import('./commands/cloud-logout.js');
    await cloudLogoutCommand();
  });

cloud
  .command('connect')
  .description('Register current repository with VGuard Cloud')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .option('--key <key>', 'Use an existing project API key (skip login)')
  .option('--project-id <id>', 'Project ID (required with --key)')
  .action(async (options: { name?: string; key?: string; projectId?: string }) => {
    const { cloudConnectCommand } = await import('./commands/cloud-connect.js');
    await cloudConnectCommand(options);
  });

cloud
  .command('status')
  .description('Show Cloud connection status')
  .action(async () => {
    const { cloudStatusCommand } = await import('./commands/cloud-status.js');
    await cloudStatusCommand();
  });

program
  .command('sync')
  .description('Upload rule-hits data to VGuard Cloud')
  .option('--force', 'Re-upload all data (ignores cursor)')
  .option('--dry-run', 'Show what would be uploaded without sending')
  .action(async (options: { force?: boolean; dryRun?: boolean }) => {
    const { syncCommand } = await import('./commands/sync.js');
    await syncCommand(options);
  });

// Ignore subcommands (.vguardignore management)
const ignore = program
  .command('ignore')
  .description('Manage .vguardignore (exclude files from rules, hooks, and scans)');

ignore
  .command('list')
  .description('List all active ignore patterns, grouped by source')
  .action(async () => {
    const { ignoreListCommand } = await import('./commands/ignore.js');
    ignoreListCommand();
  });

ignore
  .command('add <pattern>')
  .description('Append a pattern to .vguardignore (creates it if missing)')
  .action(async (pattern: string) => {
    const { ignoreAddCommand } = await import('./commands/ignore.js');
    await ignoreAddCommand(pattern);
  });

ignore
  .command('remove <pattern>')
  .description('Remove an exact pattern from .vguardignore')
  .action(async (pattern: string) => {
    const { ignoreRemoveCommand } = await import('./commands/ignore.js');
    await ignoreRemoveCommand(pattern);
  });

ignore
  .command('check <path>')
  .description('Print whether a path is ignored and which source matched')
  .action(async (path: string) => {
    const { ignoreCheckCommand } = await import('./commands/ignore.js');
    ignoreCheckCommand(path);
  });

ignore
  .command('init')
  .description('Create a .vguardignore with the default template')
  .action(async () => {
    const { ignoreInitCommand } = await import('./commands/ignore.js');
    await ignoreInitCommand();
  });

program.parse();
