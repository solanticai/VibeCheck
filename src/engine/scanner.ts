import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Rule, HookContext, ResolvedConfig, VGuardConfig, Preset } from '../types.js';
import { getAllRules } from './registry.js';
import { normalizePath, getExtension, matchesPattern } from '../utils/path.js';
import { buildGitContext } from '../utils/git.js';
import { createIgnoreMatcher, type IgnoreMatcher } from '../utils/ignore.js';
import { resolveConfigForFile } from '../config/loader.js';
import { findWorkspaceOverride } from '../config/workspace-overrides.js';

/** A single issue found during scanning */
export interface ScanIssue {
  ruleId: string;
  severity: 'block' | 'warn' | 'info';
  filePath: string;
  message: string;
  fix?: string;
}

/** Result of a full project scan */
export interface ScanResult {
  filesScanned: number;
  issues: ScanIssue[];
  hasBlockingIssues: boolean;
}

/** Options for the scanner */
export interface ScanOptions {
  rootDir: string;
  config: ResolvedConfig;
  include?: string[];
  /**
   * Optional ignore matcher override (primarily for tests). When absent, a
   * matcher is created from `.vguardignore` + built-in defaults at `rootDir`.
   */
  ignoreMatcher?: IgnoreMatcher;
  /**
   * When provided alongside `presetMap`, the scanner re-resolves the
   * config per file using `config.monorepo.overrides`. Omit both to
   * keep the default single-config behaviour.
   */
  userConfig?: VGuardConfig;
  presetMap?: Map<string, Preset>;
}

const SCANNABLE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mts',
  'mjs',
  'sql',
  'css',
  'scss',
  'sass',
  'less',
]);

/**
 * Scan a project directory and run all applicable rules against each file.
 * This is the engine behind `vguard lint`.
 */
export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const { rootDir, config } = options;
  const ignoreMatcher = options.ignoreMatcher ?? createIgnoreMatcher(rootDir);

  const allRules = getAllRules();
  const gitContext = buildGitContext(rootDir);

  type ScanRuleSet = Array<{
    rule: Rule;
    config: ResolvedConfig['rules'] extends Map<string, infer V> ? V : never;
  }>;

  function buildScanRules(rc: ResolvedConfig): ScanRuleSet {
    const out: ScanRuleSet = [];
    for (const [ruleId, ruleConfig] of rc.rules) {
      if (!ruleConfig.enabled) continue;
      const rule = allRules.get(ruleId);
      if (!rule) continue;
      if (rule.match?.tools && !rule.match.tools.includes('Write')) continue;
      if (rule.events.length === 1 && rule.events[0] === 'Stop') continue;
      out.push({ rule, config: ruleConfig });
    }
    return out;
  }

  const defaultScanRules = buildScanRules(config);

  // Per-workspace cache so files that match the same override share a
  // resolved config and scan-rule set.
  const workspaceCache = new Map<string, { cfg: ResolvedConfig; scanRules: ScanRuleSet }>();
  const hasOverrides =
    options.userConfig?.monorepo?.overrides &&
    Object.keys(options.userConfig.monorepo.overrides).length > 0 &&
    options.presetMap;

  function resolveForFile(filePath: string): { cfg: ResolvedConfig; scanRules: ScanRuleSet } {
    if (!hasOverrides) return { cfg: config, scanRules: defaultScanRules };
    const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
    const match = findWorkspaceOverride(options.userConfig!.monorepo, relPath);
    if (!match) return { cfg: config, scanRules: defaultScanRules };

    // Cache key: the stringified override keys that matched. Use the
    // override reference identity via JSON of keys it touches.
    const cacheKey = JSON.stringify({ p: match.presets ?? null, r: match.rules ?? null });
    let cached = workspaceCache.get(cacheKey);
    if (!cached) {
      const cfg = resolveConfigForFile(options.userConfig!, relPath, options.presetMap);
      cached = { cfg, scanRules: buildScanRules(cfg) };
      workspaceCache.set(cacheKey, cached);
    }
    return cached;
  }

  // Walk the directory
  const files = walkDirectory(rootDir, ignoreMatcher);
  const issues: ScanIssue[] = [];

  for (const filePath of files) {
    const ext = getExtension(filePath);
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const { cfg: fileConfig, scanRules: fileScanRules } = resolveForFile(filePath);

    // Build a synthetic HookContext for this file
    const context: HookContext = {
      event: 'PreToolUse',
      tool: 'Write',
      toolInput: {
        file_path: filePath,
        content,
      },
      projectConfig: fileConfig,
      gitContext,
    };

    // Run applicable rules
    for (const { rule, config: ruleConfig } of fileScanRules) {
      // Check file match patterns
      if (rule.match?.include && !matchesPattern(filePath, rule.match.include)) continue;
      if (rule.match?.exclude && matchesPattern(filePath, rule.match.exclude)) continue;

      try {
        const result = await rule.check(context);
        if (result.status !== 'pass') {
          issues.push({
            ruleId: result.ruleId,
            severity:
              ruleConfig.severity === 'info'
                ? 'info'
                : result.status === 'block'
                  ? ruleConfig.severity
                  : result.status,
            filePath: normalizePath(filePath),
            message: result.message ?? `Rule ${rule.id} violation`,
            fix: result.fix,
          });
        }
      } catch {
        // Skip rule errors in scan mode
      }
    }
  }

  return {
    filesScanned: files.length,
    issues,
    hasBlockingIssues: issues.some((i) => i.severity === 'block'),
  };
}

/**
 * Recursively walk a directory, skipping any paths that the IgnoreMatcher
 * says to ignore. Ignored directories are short-circuited (their contents
 * are never read), so the scanner doesn't walk into node_modules/, .next/,
 * etc.
 */
function walkDirectory(dir: string, matcher: IgnoreMatcher): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          // Probe with a trailing slash so directory-only patterns match.
          if (matcher.isIgnored(fullPath + '/')) continue;
          files.push(...walkDirectory(fullPath, matcher));
        } else if (stat.isFile()) {
          if (matcher.isIgnored(fullPath)) continue;
          files.push(fullPath);
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Directory not readable
  }

  return files;
}
