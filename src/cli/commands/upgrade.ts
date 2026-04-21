import { checkForUpdates } from '../../upgrade/checker.js';
import { discoverConfigFile } from '../../config/discovery.js';
import { loadValidatedConfig } from '../../config/load-validated.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { info, warn } from '../ui/log.js';
import { startSpinner } from '../ui/spinner.js';

export async function upgradeCommand(options: { check?: boolean; apply?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  printBanner('Upgrade', options.apply ? 'Applying updates' : 'Checking for updates');

  const packagesToCheck = ['@anthril/vguard'];

  const discovered = discoverConfigFile(projectRoot);
  if (discovered) {
    try {
      const config = await loadValidatedConfig(projectRoot);
      if (config.plugins) {
        packagesToCheck.push(...config.plugins);
      }
    } catch {
      // Config errors during upgrade are non-fatal — still check vguard itself.
    }
  }

  const spinner = startSpinner('Querying npm registry');
  const updates = checkForUpdates(packagesToCheck);
  spinner.succeed(`Checked ${packagesToCheck.length} package(s)`);

  const available = updates.filter((u) => u.hasUpdate);

  if (available.length === 0) {
    info(`  ${color.green(glyph('pass'))} All packages are up to date.\n`);
    return;
  }

  info(`  ${color.bold('Available updates:')}\n`);
  for (const update of available) {
    const arrow = color.dim(glyph('arrow'));
    info(
      `    ${color.bold(update.name)}: ${color.dim(update.current)} ${arrow} ${color.green(update.latest)}`,
    );
  }

  const mainUpdate = available.find((u) => u.name === '@anthril/vguard');
  if (mainUpdate) {
    info('');
    displayVersionChanges(mainUpdate.current, mainUpdate.latest);
  }

  if (options.check) {
    info('\n  Run `vguard upgrade --apply` to apply updates.\n');
    return;
  }

  if (!options.apply) {
    info('\n  Run `vguard upgrade --apply` to apply these updates.\n');
    return;
  }

  info(`\n  ${color.bold('Updating packages')}${color.dim('...')}\n`);
  const { execSync } = await import('node:child_process');
  const { isValidNpmPackageName } = await import('../../utils/validation.js');

  for (const update of available) {
    if (!isValidNpmPackageName(update.name)) {
      warn(`    Skipping "${update.name}": invalid package name`);
      continue;
    }

    try {
      info(`    ${color.cyan(glyph('arrow'))} Updating ${update.name}...`);
      execSync(`npm install ${update.name}@${update.latest}`, {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      info(`    ${color.green(glyph('pass'))} Updated ${update.name} to ${update.latest}`);
    } catch (err) {
      warn(
        `    ${glyph('fail')} Failed to update ${update.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  info(`\n  ${color.green('Updates applied.')} Run \`vguard generate\` to regenerate hooks.\n`);
}

function displayVersionChanges(current: string, latest: string): void {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  if (latestParts[0] > currentParts[0]) {
    warn(`  ${glyph('warn')} MAJOR version upgrade - may contain breaking changes.`);
    info('  Review the CHANGELOG before upgrading.');
  } else if (latestParts[1] > currentParts[1]) {
    info(
      `  ${color.cyan(glyph('info'))} Minor version upgrade - new features and rules may be available.`,
    );
    info('  Run `vguard generate` after upgrading to pick up new rules.');
  } else {
    info(`  ${color.cyan(glyph('info'))} Patch version upgrade - bug fixes and improvements.`);
  }
}
