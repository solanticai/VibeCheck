import { existsSync } from 'node:fs';
import { join } from 'node:path';

import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { getAllRules } from '../../engine/registry.js';
import type { VibeCheckConfig } from '../../types.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function doctorCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const results: CheckResult[] = [];

  console.log('\n  VibeCheck Doctor\n');

  // 1. Check config file exists
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    results.push({
      name: 'Config file',
      status: 'fail',
      message: 'No vibecheck config found. Run `vibecheck init`.',
    });
    printResults(results);
    return;
  }
  results.push({
    name: 'Config file',
    status: 'pass',
    message: `Found ${discovered.path}`,
  });

  // 2. Validate config
  let resolvedConfig;
  try {
    const rawConfig = await readRawConfig(discovered);
    const presetMap = getAllPresets();
    resolvedConfig = resolveConfig(rawConfig as VibeCheckConfig, presetMap);
    results.push({
      name: 'Config valid',
      status: 'pass',
      message: `${resolvedConfig.rules.size} rules configured`,
    });
  } catch (error) {
    results.push({
      name: 'Config valid',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    printResults(results);
    return;
  }

  // 3. Check for unknown rules
  const allRuleIds = new Set(getAllRules().keys());
  for (const [ruleId, ruleConfig] of resolvedConfig.rules) {
    if (ruleConfig.enabled && !allRuleIds.has(ruleId)) {
      results.push({
        name: `Rule: ${ruleId}`,
        status: 'warn',
        message: `Rule "${ruleId}" is configured but not registered. Is it from a plugin?`,
      });
    }
  }

  // 4. Check active rules
  const enabledRules = Array.from(resolvedConfig.rules.entries()).filter(([, c]) => c.enabled);
  const securityRules = enabledRules.filter(([id]) => id.startsWith('security/'));

  if (securityRules.length === 0) {
    results.push({
      name: 'Security rules',
      status: 'warn',
      message:
        'No security rules enabled. Consider enabling branch-protection and destructive-commands.',
    });
  } else {
    results.push({
      name: 'Security rules',
      status: 'pass',
      message: `${securityRules.length} security rules active`,
    });
  }

  // 5. Check pre-compiled config cache
  const cachePath = join(projectRoot, '.vibecheck', 'cache', 'resolved-config.json');
  if (!existsSync(cachePath)) {
    results.push({
      name: 'Config cache',
      status: 'warn',
      message: 'No pre-compiled config cache. Run `vibecheck generate` for faster hooks.',
    });
  } else {
    results.push({
      name: 'Config cache',
      status: 'pass',
      message: 'Pre-compiled config exists',
    });
  }

  // 6. Check Claude Code hooks
  if (resolvedConfig.agents.includes('claude-code')) {
    const settingsPath = join(projectRoot, '.claude', 'settings.json');
    if (!existsSync(settingsPath)) {
      results.push({
        name: 'Claude Code hooks',
        status: 'fail',
        message: 'No .claude/settings.json found. Run `vibecheck generate`.',
      });
    } else {
      results.push({
        name: 'Claude Code hooks',
        status: 'pass',
        message: 'settings.json exists',
      });
    }

    // Check hook scripts
    const hookDir = join(projectRoot, '.vibecheck', 'hooks');
    if (!existsSync(hookDir)) {
      results.push({
        name: 'Hook scripts',
        status: 'fail',
        message: 'No hook scripts found. Run `vibecheck generate`.',
      });
    } else {
      results.push({
        name: 'Hook scripts',
        status: 'pass',
        message: 'Hook scripts directory exists',
      });
    }
  }

  // 7. Check node_modules
  const vibecheckInModules = existsSync(join(projectRoot, 'node_modules', 'vibecheck'));
  if (!vibecheckInModules) {
    results.push({
      name: 'node_modules',
      status: 'warn',
      message: 'vibecheck not found in node_modules. Hook scripts may not work. Run `npm install`.',
    });
  }

  printResults(results);
}

function printResults(results: CheckResult[]): void {
  const icons = { pass: '\u2713', warn: '!', fail: '\u2717' };
  let hasIssues = false;

  for (const result of results) {
    const icon = icons[result.status];
    const prefix = result.status === 'pass' ? '  ' : result.status === 'warn' ? '  ' : '  ';
    console.log(`${prefix}${icon} ${result.name}: ${result.message}`);
    if (result.status !== 'pass') hasIssues = true;
  }

  console.log();
  if (hasIssues) {
    console.log('  Some issues found. Fix them and run `vibecheck doctor` again.\n');
  } else {
    console.log('  All checks passed. VibeCheck is healthy.\n');
  }
}
