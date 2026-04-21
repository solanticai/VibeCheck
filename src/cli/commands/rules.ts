import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import '../../presets/index.js';
import '../../rules/index.js';

import { getAllRules } from '../../engine/registry.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { loadLocalRules } from '../../plugins/local-rule-loader.js';
import type { VGuardConfig } from '../../types.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { error, info } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

export async function rulesListCommand(options: { all?: boolean; json?: boolean }): Promise<void> {
  const projectRoot = process.cwd();
  await loadLocalRules(projectRoot);
  const allRules = getAllRules();

  const discovered = discoverConfigFile(projectRoot);
  // `resolved.rules` holds the final severity after preset + user merging.
  // Use it as the source of truth so `rules list` matches `config show` and
  // the adapter-generated enforcement docs. Falling back to the catalogue
  // severity on config errors keeps the listing useful when the config is
  // broken.
  let resolvedRules: Map<string, { enabled: boolean; severity: 'block' | 'warn' | 'info' }> =
    new Map();

  if (discovered) {
    try {
      const rawConfig = (await readRawConfig(discovered)) as VGuardConfig;
      const presetMap = getAllPresets();
      const resolved = resolveConfig(rawConfig, presetMap);
      resolvedRules = new Map(
        Array.from(resolved.rules.entries()).map(([id, cfg]) => [
          id,
          { enabled: cfg.enabled, severity: cfg.severity },
        ]),
      );
    } catch {
      // Config errors are non-fatal for listing
    }
  }

  const rules = Array.from(allRules.entries())
    .map(([id, rule]) => {
      const res = resolvedRules.get(id);
      return {
        id,
        name: rule.name,
        severity: res?.severity ?? rule.severity,
        enabled: res?.enabled ?? false,
        description: rule.description,
      };
    })
    .filter((r) => options.all || r.enabled)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (options.json) {
    process.stdout.write(JSON.stringify(rules, null, 2) + '\n');
    return;
  }

  if (rules.length === 0) {
    info('');
    info('  No rules found.');
    if (!options.all) {
      info('  Use --all to include disabled rules.');
    }
    info('');
    return;
  }

  printBanner('Rules', `${rules.filter((r) => r.enabled).length} enabled / ${allRules.size} total`);

  const grouped = new Map<string, typeof rules>();
  for (const rule of rules) {
    const category = rule.id.split('/')[0];
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(rule);
  }

  for (const [category, categoryRules] of grouped) {
    info(`  ${color.bold(category + '/')}`);
    for (const rule of categoryRules) {
      const status = rule.enabled ? color.green(glyph('pass')) : color.dim(glyph('dot'));
      const sev = rule.severity.toUpperCase().padEnd(5);
      const sevColored =
        rule.severity === 'block'
          ? color.red(sev)
          : rule.severity === 'warn'
            ? color.yellow(sev)
            : color.cyan(sev);
      const line = `    ${status} ${rule.id.padEnd(40)} ${sevColored}  ${rule.name}`;
      info(rule.enabled ? line : color.dim(line));
    }
    info('');
  }

  const enabled = rules.filter((r) => r.enabled).length;
  const total = allRules.size;
  info(`  ${enabled}/${total} rules enabled.`);
  if (!options.all && total > enabled) {
    info('  Use --all to include disabled rules.');
  }
  info('');
}

export async function rulesEnableCommand(ruleId: string): Promise<void> {
  const projectRoot = process.cwd();
  const allRules = getAllRules();

  if (!allRules.has(ruleId)) {
    error(`Unknown rule "${ruleId}".`);
    error('  Run `vguard rules list --all` to see available rules.');
    process.exit(EXIT.USAGE);
  }

  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    error('No VGuard config found. Run `vguard init` first.');
    process.exit(EXIT.NO_INPUT);
  }

  if (configPath.endsWith('.json')) {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.rules = config.rules ?? {};
    config.rules[ruleId] = true;
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    info(`  ${color.green(glyph('pass'))} Enabled rule: ${color.bold(ruleId)}`);
    info('  Run `vguard generate` to update hooks.\n');
  } else {
    info(`\n  Add the following to your vguard.config.ts:\n`);
    info(`    rules: { '${ruleId}': true },`);
    info(`\n  Then run \`vguard generate\` to update hooks.\n`);
  }
}

export async function rulesDisableCommand(ruleId: string): Promise<void> {
  const projectRoot = process.cwd();
  const allRules = getAllRules();

  if (!allRules.has(ruleId)) {
    error(`Unknown rule "${ruleId}".`);
    error('  Run `vguard rules list --all` to see available rules.');
    process.exit(EXIT.USAGE);
  }

  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    error('No VGuard config found. Run `vguard init` first.');
    process.exit(EXIT.NO_INPUT);
  }

  if (configPath.endsWith('.json')) {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    config.rules = config.rules ?? {};
    config.rules[ruleId] = false;
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    info(`  ${color.yellow(glyph('dot'))} Disabled rule: ${color.bold(ruleId)}`);
    info('  Run `vguard generate` to update hooks.\n');
  } else {
    info(`\n  Add the following to your vguard.config.ts:\n`);
    info(`    rules: { '${ruleId}': false },`);
    info(`\n  Then run \`vguard generate\` to update hooks.\n`);
  }
}

function findConfigPath(projectRoot: string): string | null {
  const candidates = [
    'vguard.config.ts',
    'vguard.config.js',
    'vguard.config.mjs',
    '.vguardrc.json',
  ];
  for (const file of candidates) {
    const path = join(projectRoot, file);
    if (existsSync(path)) return path;
  }
  return null;
}
