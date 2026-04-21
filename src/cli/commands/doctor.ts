import { existsSync } from 'node:fs';
import { join } from 'node:path';

import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { getAllRules } from '../../engine/registry.js';
import { loadLocalRules } from '../../plugins/local-rule-loader.js';
import { readPerfEntries, calculatePerfStats, PERF_BUDGET_MS } from '../../engine/perf.js';
import { createIgnoreMatcher, HARDCODED_DEFAULTS } from '../../utils/ignore.js';
import type { VGuardConfig } from '../../types.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { printBanner } from '../ui/banner.js';
import { info } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface DoctorOptions {
  json?: boolean;
  strict?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const results: CheckResult[] = [];

  if (!options.json) {
    printBanner('Doctor', 'Config & hook health check');
  }

  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    results.push({
      name: 'Config file',
      status: 'fail',
      message: 'No VGuard config found. Run `vguard init`.',
    });
    finalize(results, options);
    return;
  }

  results.push({
    name: 'Config file',
    status: 'pass',
    message: `Found ${discovered.path}`,
  });

  // Load project-local rules from .vguard/rules/custom/ before resolving
  // the config so any rule IDs referenced there are in the registry.
  const localRuleResult = await loadLocalRules(projectRoot);
  if (localRuleResult.directoryExists) {
    if (localRuleResult.errors.length > 0) {
      for (const err of localRuleResult.errors) {
        results.push({
          name: `Local rule: ${err.file}`,
          status: 'warn',
          message: err.error,
        });
      }
    }
    if (localRuleResult.downgraded.length > 0) {
      results.push({
        name: 'Local rule severity',
        status: 'warn',
        message:
          `${localRuleResult.downgraded.length} local rule(s) downgraded to "warn". ` +
          'Block-severity enforcement requires a published plugin via `config.plugins`.',
      });
    }
    results.push({
      name: 'Local rules',
      status: 'pass',
      message: `${localRuleResult.rulesAdded} rule(s) loaded from .vguard/rules/custom/`,
    });
  }

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
  } catch (err) {
    results.push({
      name: 'Config valid',
      status: 'fail',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    finalize(results, options);
    return;
  }

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
        message: `Hook p95 is ${stats.p95Ms}ms (budget: ${PERF_BUDGET_MS}ms) - ${stats.count} samples.`,
      });
    }
  }

  const vguardInModules = existsSync(join(projectRoot, 'node_modules', 'vguard'));
  if (!vguardInModules) {
    results.push({
      name: 'node_modules',
      status: 'warn',
      message: 'VGuard not found in node_modules. Hook scripts may not work. Run `npm install`.',
    });
  }

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
        'No .vguardignore found - using defaults only. Run `vguard ignore init` to add project-specific excludes.',
    });
  }

  const learnIgnore = (rawConfig.learn?.ignorePaths ?? []).length;
  if (learnIgnore > 0) {
    results.push({
      name: 'Legacy config',
      status: 'warn',
      message: `learn.ignorePaths is deprecated (${learnIgnore} entries) - move them to .vguardignore so they apply to lint + hooks too.`,
    });
  }

  const cloudExclude = (resolvedConfig.cloud?.excludePaths ?? []).length;
  if (cloudExclude > 0) {
    results.push({
      name: 'Legacy config',
      status: 'warn',
      message: `cloud.excludePaths is deprecated (${cloudExclude} entries) - move them to .vguardignore for project-wide exclusion.`,
    });
  }

  finalize(results, options);
}

function finalize(results: CheckResult[], options: DoctorOptions): void {
  const hasFail = results.some((r) => r.status === 'fail');
  const hasWarn = results.some((r) => r.status === 'warn');
  const effectiveStatus: 'pass' | 'warn' | 'fail' = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  if (options.json) {
    const payload = {
      status: effectiveStatus,
      strict: Boolean(options.strict),
      checks: results,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    const exitCode = hasFail ? EXIT.CONFIG : hasWarn && options.strict ? EXIT.CONFIG : EXIT.OK;
    process.exit(exitCode);
  }

  for (const result of results) {
    let icon: string;
    if (result.status === 'pass') {
      icon = color.green(glyph('pass'));
    } else if (result.status === 'warn') {
      icon = color.yellow(glyph('warn'));
    } else {
      icon = color.red(glyph('fail'));
    }
    info(`  ${icon} ${color.bold(result.name)}: ${result.message}`);
  }

  info('');
  if (hasFail) {
    info(`  ${color.red('Some checks failed.')} Fix them and run \`vguard doctor\` again.\n`);
    process.exit(EXIT.CONFIG);
  }

  if (hasWarn && options.strict) {
    info(
      `  ${color.red('Warnings detected and --strict is set.')} Treating warnings as failures.\n`,
    );
    process.exit(EXIT.CONFIG);
  }

  if (hasWarn) {
    info(`  ${color.yellow('Completed with warnings.')} Review the items above.\n`);
  } else {
    info(`  ${color.green('All checks passed.')} VGuard is healthy.\n`);
  }
  process.exit(EXIT.OK);
}
