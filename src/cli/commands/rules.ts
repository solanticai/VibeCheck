import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import '../../presets/index.js';
import '../../rules/index.js';

import { getAllRules } from '../../engine/registry.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import type { VGuardConfig } from '../../types.js';

export async function rulesListCommand(options: { all?: boolean; json?: boolean }): Promise<void> {
  const projectRoot = process.cwd();
  const allRules = getAllRules();

  // Try to load config to determine which rules are enabled
  const discovered = discoverConfigFile(projectRoot);
  let enabledRuleIds = new Set<string>();

  if (discovered) {
    try {
      const rawConfig = (await readRawConfig(discovered)) as VGuardConfig;
      const presetMap = getAllPresets();
      const resolved = resolveConfig(rawConfig, presetMap);
      enabledRuleIds = new Set(
        Array.from(resolved.rules.entries())
          .filter(([, config]) => config.enabled)
          .map(([id]) => id),
      );
    } catch {
      // Config errors are non-fatal for listing
    }
  }

  const rules = Array.from(allRules.entries())
    .map(([id, rule]) => ({
      id,
      name: rule.name,
      severity: rule.severity,
      enabled: enabledRuleIds.has(id),
      description: rule.description,
    }))
    .filter((r) => options.all || r.enabled)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (options.json) {
    console.log(JSON.stringify(rules, null, 2));
    return;
  }

  if (rules.length === 0) {
    console.log('\n  No rules found.');
    if (!options.all) {
      console.log('  Use --all to include disabled rules.\n');
    }
    return;
  }

  console.log('\n  VGuard Rules\n');

  // Group by category
  const grouped = new Map<string, typeof rules>();
  for (const rule of rules) {
    const category = rule.id.split('/')[0];
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(rule);
  }

  for (const [category, categoryRules] of grouped) {
    console.log(`  ${category}/`);
    for (const rule of categoryRules) {
      const status = rule.enabled ? '\u2713' : '\u2717';
      const severityTag = rule.severity.toUpperCase().padEnd(5);
      console.log(`    ${status} ${rule.id.padEnd(40)} ${severityTag}  ${rule.name}`);
    }
    console.log();
  }

  const enabled = rules.filter((r) => r.enabled).length;
  const total = allRules.size;
  console.log(`  ${enabled}/${total} rules enabled.`);
  if (!options.all && total > enabled) {
    console.log('  Use --all to include disabled rules.');
  }
  console.log();
}

export async function rulesEnableCommand(ruleId: string): Promise<void> {
  const projectRoot = process.cwd();
  const allRules = getAllRules();

  if (!allRules.has(ruleId)) {
    console.error(`  Unknown rule: "${ruleId}".`);
    console.error('  Run `vguard rules list --all` to see available rules.');
    process.exit(1);
  }

  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    console.error('  No VGuard config found. Run `vguard init` first.');
    process.exit(1);
  }

  if (configPath.endsWith('.json')) {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.rules = config.rules ?? {};
    config.rules[ruleId] = true;
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`  Enabled rule: ${ruleId}`);
    console.log('  Run `vguard generate` to update hooks.\n');
  } else {
    console.log(`\n  Add the following to your vguard.config.ts:\n`);
    console.log(`    rules: { '${ruleId}': true },`);
    console.log(`\n  Then run \`vguard generate\` to update hooks.\n`);
  }
}

export async function rulesDisableCommand(ruleId: string): Promise<void> {
  const projectRoot = process.cwd();
  const allRules = getAllRules();

  if (!allRules.has(ruleId)) {
    console.error(`  Unknown rule: "${ruleId}".`);
    console.error('  Run `vguard rules list --all` to see available rules.');
    process.exit(1);
  }

  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    console.error('  No VGuard config found. Run `vguard init` first.');
    process.exit(1);
  }

  if (configPath.endsWith('.json')) {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.rules = config.rules ?? {};
    config.rules[ruleId] = false;
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`  Disabled rule: ${ruleId}`);
    console.log('  Run `vguard generate` to update hooks.\n');
  } else {
    console.log(`\n  Add the following to your vguard.config.ts:\n`);
    console.log(`    rules: { '${ruleId}': false },`);
    console.log(`\n  Then run \`vguard generate\` to update hooks.\n`);
  }
}

function findConfigPath(projectRoot: string): string | null {
  const candidates = ['vguard.config.ts', 'vguard.config.js', 'vguard.config.mjs', '.vguardrc.json'];
  for (const file of candidates) {
    const path = join(projectRoot, file);
    if (existsSync(path)) return path;
  }
  return null;
}
