import { existsSync } from 'node:fs';
import { join } from 'node:path';

import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { getAllRules } from '../../engine/registry.js';
import { readPerfEntries, calculatePerfStats, PERF_BUDGET_MS } from '../../engine/perf.js';
import { createIgnoreMatcher, HARDCODED_DEFAULTS } from '../../utils/ignore.js';
import type { VGuardConfig } from '../../types.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function doctorCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const results: CheckResult[] = [];

  console.log('\n  VGuard Doctor\n');

  // 1. Check config file exists
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    results.push({
      name: 'Config file',
      status: 'fail',
      message: 'No VGuard config found. Run `vguard init`.',
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
  let rawConfig: VGuardConfig;
  try {
    rawConfig = (await readRawConfig(discovered)) as VGuardConfig;
    const presetMap = getAllPresets();
    resolvedConfig = resolveConfig(rawConfig, presetMap);
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
  const cachePath = join(projectRoot, '.vguard', 'cache', 'resolved-config.json');
  if (!existsSync(cachePath)) {
    results.push({
      name: 'Config cache',
      status: 'warn',
      message: 'No pre-compiled config cache. Run `vguard generate` for faster hooks.',
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
        message: 'No .claude/settings.json found. Run `vguard generate`.',
      });
    } else {
      results.push({
        name: 'Claude Code hooks',
        status: 'pass',
        message: 'settings.json exists',
      });
    }

    // Check hook scripts
    const hookDir = join(projectRoot, '.vguard', 'hooks');
    if (!existsSync(hookDir)) {
      results.push({
        name: 'Hook scripts',
        status: 'fail',
        message: 'No hook scripts found. Run `vguard generate`.',
      });
    } else {
      results.push({
        name: 'Hook scripts',
        status: 'pass',
        message: 'Hook scripts directory exists',
      });
    }
  }

  // 7. Check performance budget
  const perfEntries = readPerfEntries(projectRoot);
  if (perfEntries.length > 0) {
    const stats = calculatePerfStats(perfEntries);
    if (stats.p95Ms > PERF_BUDGET_MS) {
      results.push({
        name: 'Performance',
        status: 'warn',
        message: `Hook p95 is ${stats.p95Ms}ms (budget: ${PERF_BUDGET_MS}ms). ${stats.overBudgetPct}% of runs exceed budget.`,
      });
    } else {
      results.push({
        name: 'Performance',
        status: 'pass',
        message: `Hook p95 is ${stats.p95Ms}ms (budget: ${PERF_BUDGET_MS}ms) — ${stats.count} samples.`,
      });
    }
  }

  // 8. Check node_modules
  const vguardInModules = existsSync(join(projectRoot, 'node_modules', 'vguard'));
  if (!vguardInModules) {
    results.push({
      name: 'node_modules',
      status: 'warn',
      message: 'VGuard not found in node_modules. Hook scripts may not work. Run `npm install`.',
    });
  }

  // 9. Check .vguardignore + legacy ignore-field deprecations.
  const matcher = createIgnoreMatcher(projectRoot);
  if (matcher.hasFile) {
    results.push({
      name: 'Ignore rules',
      status: 'pass',
      message: `${matcher.filePatterns.length} patterns from .vguardignore + ${HARDCODED_DEFAULTS.length} defaults active`,
    });
  } else {
    results.push({
      name: 'Ignore rules',
      status: 'warn',
      message:
        'No .vguardignore found — using defaults only. Run `vguard ignore init` to add project-specific excludes.',
    });
  }

  const learnIgnore = (rawConfig.learn?.ignorePaths ?? []).length;
  if (learnIgnore > 0) {
    results.push({
      name: 'Legacy config',
      status: 'warn',
      message: `learn.ignorePaths is deprecated (${learnIgnore} entries) — move them to .vguardignore so they apply to lint + hooks too.`,
    });
  }

  const cloudExclude = (resolvedConfig.cloud?.excludePaths ?? []).length;
  if (cloudExclude > 0) {
    results.push({
      name: 'Legacy config',
      status: 'warn',
      message: `cloud.excludePaths is deprecated (${cloudExclude} entries) — move them to .vguardignore for project-wide exclusion.`,
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
    console.log('  Some issues found. Fix them and run `vguard doctor` again.\n');
  } else {
    console.log('  All checks passed. VGuard is healthy.\n');
  }
}
