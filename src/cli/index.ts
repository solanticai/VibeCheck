#!/usr/bin/env node

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
  .name('vibecheck')
  .description('AI coding guardrails framework. Runtime-enforced quality controls.')
  .version(getVersion());

program
  .command('init')
  .description('Interactive setup wizard — configure VibeCheck for your project')
  .action(async () => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand();
  });

program
  .command('add <id>')
  .description('Add a rule or preset (e.g., vibecheck add security/branch-protection)')
  .action(async (id: string) => {
    const { addCommand } = await import('./commands/add.js');
    await addCommand(id);
  });

program
  .command('remove <id>')
  .description('Remove a rule or preset (e.g., vibecheck remove preset:nextjs-15)')
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
  .command('report')
  .description('Generate quality dashboard from rule hit data')
  .action(async () => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand();
  });

program
  .command('eject')
  .description('Export standalone hooks (removes vibecheck dependency)')
  .action(async () => {
    const { ejectCommand } = await import('./commands/eject.js');
    await ejectCommand();
  });

program
  .command('upgrade')
  .description('Check for and apply updates to vibecheck and plugins')
  .option('--check', 'Only check for updates, do not apply')
  .action(async (options: { check?: boolean }) => {
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

// Cloud subcommands
const cloud = program
  .command('cloud')
  .description('VibeCheck Cloud commands (login, connect, status)');

cloud
  .command('login')
  .description('Authenticate with VibeCheck Cloud')
  .option('--token <token>', 'Provide auth token directly')
  .action(async (options: { token?: string }) => {
    const { cloudLoginCommand } = await import('./commands/cloud-login.js');
    await cloudLoginCommand(options);
  });

cloud
  .command('logout')
  .description('Remove stored Cloud credentials')
  .action(async () => {
    const { cloudLogoutCommand } = await import('./commands/cloud-logout.js');
    await cloudLogoutCommand();
  });

cloud
  .command('connect')
  .description('Register current repository with VibeCheck Cloud')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .action(async (options: { name?: string }) => {
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
  .description('Upload rule-hits data to VibeCheck Cloud')
  .option('--force', 'Re-upload all data (ignores cursor)')
  .option('--dry-run', 'Show what would be uploaded without sending')
  .action(async (options: { force?: boolean; dryRun?: boolean }) => {
    const { syncCommand } = await import('./commands/sync.js');
    await syncCommand(options);
  });

program.parse();
