import { checkForUpdates } from '../../upgrade/checker.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import type { VGuardConfig } from '../../types.js';

export async function upgradeCommand(options: { check?: boolean; apply?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VGuard Upgrade\n');

  // Determine packages to check
  const packagesToCheck = ['@anthril/vguard'];

  // Check for plugin packages
  const discovered = discoverConfigFile(projectRoot);
  if (discovered) {
    try {
      const rawConfig = await readRawConfig(discovered);
      const config = rawConfig as VGuardConfig;
      if (config.plugins) {
        packagesToCheck.push(...config.plugins);
      }
    } catch {
      // Ignore config errors during upgrade
    }
  }

  console.log('  Checking for updates...\n');

  const updates = checkForUpdates(packagesToCheck);
  const available = updates.filter((u) => u.hasUpdate);

  if (available.length === 0) {
    console.log('  All packages are up to date.\n');
    return;
  }

  // Display available updates with version diff
  console.log('  Available updates:\n');
  for (const update of available) {
    console.log(`    ${update.name}: ${update.current} -> ${update.latest}`);
  }

  // Show what's new (for the main VGuard package)
  const mainUpdate = available.find((u) => u.name === '@anthril/vguard');
  if (mainUpdate) {
    console.log('');
    displayVersionChanges(mainUpdate.current, mainUpdate.latest);
  }

  if (options.check) {
    console.log('\n  Run `vguard upgrade --apply` to apply updates.\n');
    return;
  }

  if (!options.apply) {
    console.log('\n  Run `vguard upgrade --apply` to apply these updates.\n');
    return;
  }

  // Apply updates
  console.log('\n  Updating packages...\n');
  const { execSync } = await import('node:child_process');
  const { isValidNpmPackageName } = await import('../../utils/validation.js');

  for (const update of available) {
    if (!isValidNpmPackageName(update.name)) {
      console.error(`    Skipping "${update.name}": invalid package name`);
      continue;
    }

    try {
      console.log(`    Updating ${update.name}...`);
      execSync(`npm install ${update.name}@${update.latest}`, {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log(`    Updated ${update.name} to ${update.latest}`);
    } catch (error) {
      console.error(
        `    Failed to update ${update.name}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  console.log('\n  Updates applied. Run `vguard generate` to regenerate hooks.\n');
}

/**
 * Display a summary of changes between versions.
 * In a full implementation this would fetch release notes.
 * For now, show helpful guidance based on version jump.
 */
function displayVersionChanges(current: string, latest: string): void {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  if (latestParts[0] > currentParts[0]) {
    console.log('  MAJOR version upgrade — may contain breaking changes.');
    console.log('  Review the CHANGELOG before upgrading.');
  } else if (latestParts[1] > currentParts[1]) {
    console.log('  Minor version upgrade — new features and rules may be available.');
    console.log('  Run `vguard generate` after upgrading to pick up new rules.');
  } else {
    console.log('  Patch version upgrade — bug fixes and improvements.');
  }
}
