import '../../presets/index.js';
import '../../rules/index.js';

import { getAllPresets } from '../../config/presets.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import type { VGuardConfig } from '../../types.js';
import { addCommand } from './add.js';
import { removeCommand } from './remove.js';

export async function presetsListCommand(options: { installed?: boolean }): Promise<void> {
  const projectRoot = process.cwd();
  const allPresets = getAllPresets();

  // Determine which presets are active in the current config
  let activePresetIds = new Set<string>();

  const discovered = discoverConfigFile(projectRoot);
  if (discovered) {
    try {
      const rawConfig = (await readRawConfig(discovered)) as VGuardConfig;
      const presetMap = getAllPresets();
      const resolved = resolveConfig(rawConfig, presetMap);
      activePresetIds = new Set(resolved.presets);
    } catch {
      // Config errors are non-fatal for listing
    }
  }

  const presets = Array.from(allPresets.entries())
    .map(([id, preset]) => ({
      id,
      name: preset.name,
      description: preset.description,
      version: preset.version,
      installed: activePresetIds.has(id),
      ruleCount: Object.keys(preset.rules).length,
    }))
    .filter((p) => !options.installed || p.installed)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (presets.length === 0) {
    console.log('\n  No presets found.');
    if (options.installed) {
      console.log('  Remove --installed to see all available presets.\n');
    }
    return;
  }

  console.log('\n  VGuard Presets\n');

  for (const preset of presets) {
    const status = preset.installed ? '\u2713' : ' ';
    console.log(`  ${status} ${preset.id.padEnd(25)} ${preset.name}`);
    console.log(`    ${preset.description}`);
    console.log(`    ${preset.ruleCount} rules | v${preset.version}`);
    console.log();
  }

  const installed = presets.filter((p) => p.installed).length;
  console.log(`  ${installed}/${allPresets.size} presets installed.\n`);
}

export async function presetsAddCommand(presetId: string): Promise<void> {
  await addCommand(`preset:${presetId}`);
}

export async function presetsRemoveCommand(presetId: string): Promise<void> {
  await removeCommand(`preset:${presetId}`);
}
