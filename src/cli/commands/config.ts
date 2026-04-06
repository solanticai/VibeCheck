import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import type { VGuardConfig } from '../../types.js';

export async function configShowCommand(options: { json?: boolean; raw?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    console.error('  No VGuard config found. Run `vguard init` first.');
    process.exit(1);
  }

  const rawConfig = (await readRawConfig(discovered)) as VGuardConfig;

  if (options.raw) {
    if (options.json) {
      console.log(JSON.stringify(rawConfig, null, 2));
    } else {
      console.log('\n  VGuard Config (raw)\n');
      console.log(`  Source: ${discovered.path}\n`);
      console.log(JSON.stringify(rawConfig, null, 2));
      console.log();
    }
    return;
  }

  // Resolve config with presets applied
  const presetMap = getAllPresets();
  const resolved = resolveConfig(rawConfig, presetMap);

  if (options.json) {
    const output = {
      source: discovered.path,
      presets: resolved.presets,
      agents: resolved.agents,
      rules: Object.fromEntries(
        Array.from(resolved.rules.entries()).map(([id, config]) => [
          id,
          { enabled: config.enabled, severity: config.severity },
        ]),
      ),
      cloud: resolved.cloud ?? null,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('\n  VGuard Config (resolved)\n');
  console.log(`  Source:  ${discovered.path}`);
  console.log(`  Presets: ${resolved.presets.length > 0 ? resolved.presets.join(', ') : 'none'}`);
  console.log(`  Agents:  ${resolved.agents.join(', ')}`);
  console.log();

  // Rules summary
  const enabledRules = Array.from(resolved.rules.entries()).filter(([, c]) => c.enabled);
  const disabledRules = Array.from(resolved.rules.entries()).filter(([, c]) => !c.enabled);

  console.log(`  Rules: ${enabledRules.length} enabled, ${disabledRules.length} disabled`);
  console.log();

  if (enabledRules.length > 0) {
    console.log('  Enabled:');
    for (const [id, config] of enabledRules.sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`    \u2713 ${id.padEnd(40)} ${config.severity}`);
    }
    console.log();
  }

  if (disabledRules.length > 0) {
    console.log('  Disabled:');
    for (const [id] of disabledRules.sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`    \u2717 ${id}`);
    }
    console.log();
  }

  // Cloud status
  if (resolved.cloud) {
    console.log('  Cloud:');
    console.log(`    Enabled:   ${resolved.cloud.enabled ?? false}`);
    console.log(`    Auto-sync: ${resolved.cloud.autoSync ?? false}`);
    console.log();
  }
}

export async function configSetCommand(key: string, value: string): Promise<void> {
  const projectRoot = process.cwd();

  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    console.error('  No VGuard config found. Run `vguard init` first.');
    process.exit(1);
  }

  if (!discovered.path.endsWith('.json')) {
    console.log(`\n  TypeScript configs cannot be modified programmatically.`);
    console.log(`  Edit ${discovered.path} directly and set "${key}" to "${value}".\n`);
    return;
  }

  const { readFile, writeFile } = await import('node:fs/promises');
  const raw = await readFile(discovered.path, 'utf-8');
  const config = JSON.parse(raw);

  // Support dot-notation (e.g., "cloud.autoSync")
  const keys = key.split('.');
  let target = config;
  for (let i = 0; i < keys.length - 1; i++) {
    target[keys[i]] = target[keys[i]] ?? {};
    target = target[keys[i]];
  }

  // Parse value type
  const finalKey = keys[keys.length - 1];
  if (value === 'true') {
    target[finalKey] = true;
  } else if (value === 'false') {
    target[finalKey] = false;
  } else if (/^\d+$/.test(value)) {
    target[finalKey] = parseInt(value, 10);
  } else {
    target[finalKey] = value;
  }

  await writeFile(discovered.path, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`  Set ${key} = ${value}`);
  console.log('  Run `vguard generate` to apply changes.\n');
}
