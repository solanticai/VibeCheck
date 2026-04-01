import { checkForUpdates } from '../../upgrade/checker.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import type { VibeCheckConfig } from '../../types.js';

export async function upgradeCommand(options: { check?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VibeCheck Upgrade\n');

  // Determine packages to check
  const packagesToCheck = ['vibecheck'];

  // Check for plugin packages
  const discovered = discoverConfigFile(projectRoot);
  if (discovered) {
    try {
      const rawConfig = await readRawConfig(discovered);
      const config = rawConfig as VibeCheckConfig;
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

  console.log('  Available updates:\n');
  for (const update of available) {
    console.log(`    ${update.name}: ${update.current} -> ${update.latest}`);
  }

  if (options.check) {
    console.log('\n  Run `vibecheck upgrade` (without --check) to apply updates.\n');
    return;
  }

  // Apply updates
  console.log('\n  Updating packages...\n');
  const { execSync } = await import('node:child_process');

  for (const update of available) {
    try {
      console.log(`    Updating ${update.name}...`);
      execSync(`npm install ${update.name}@latest`, {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      console.error(
        `    Failed to update ${update.name}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  console.log('\n  Updates applied. Run `vibecheck generate` to regenerate hooks.\n');
}
