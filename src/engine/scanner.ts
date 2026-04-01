import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, HookContext, ResolvedConfig } from '../types.js';
import { getAllRules } from './registry.js';
import { normalizePath, getExtension, matchesPattern } from '../utils/path.js';
import { buildGitContext } from '../utils/git.js';

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
  exclude?: string[];
}

const DEFAULT_EXCLUDE = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '.git/',
  'coverage/',
  '.vibecheck/',
  '__pycache__/',
];

const SCANNABLE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'sql', 'css', 'scss', 'sass', 'less',
]);

/**
 * Scan a project directory and run all applicable rules against each file.
 * This is the engine behind `vibecheck lint`.
 */
export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const { rootDir, config, exclude = DEFAULT_EXCLUDE } = options;

  const allRules = getAllRules();
  const gitContext = buildGitContext(rootDir);

  // Collect applicable rules (only Write-matching rules work in scan mode)
  const scanRules: Array<{ rule: Rule; config: typeof config.rules extends Map<string, infer V> ? V : never }> = [];

  for (const [ruleId, ruleConfig] of config.rules) {
    if (!ruleConfig.enabled) continue;
    const rule = allRules.get(ruleId);
    if (!rule) continue;

    // Only include rules that match Write tool (scan simulates Write)
    if (rule.match?.tools && !rule.match.tools.includes('Write')) continue;
    // Skip Stop-only rules
    if (rule.events.length === 1 && rule.events[0] === 'Stop') continue;

    scanRules.push({ rule, config: ruleConfig });
  }

  // Walk the directory
  const files = walkDirectory(rootDir, exclude);
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

    // Build a synthetic HookContext for this file
    const context: HookContext = {
      event: 'PreToolUse',
      tool: 'Write',
      toolInput: {
        file_path: filePath,
        content,
      },
      projectConfig: config,
      gitContext,
    };

    // Run applicable rules
    for (const { rule, config: ruleConfig } of scanRules) {
      // Check file match patterns
      if (rule.match?.include && !matchesPattern(filePath, rule.match.include)) continue;
      if (rule.match?.exclude && matchesPattern(filePath, rule.match.exclude)) continue;

      try {
        const result = await rule.check(context);
        if (result.status !== 'pass') {
          issues.push({
            ruleId: result.ruleId,
            severity: ruleConfig.severity === 'info' ? 'info' : result.status === 'block' ? ruleConfig.severity : result.status,
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

/** Recursively walk a directory, respecting exclude patterns */
function walkDirectory(dir: string, exclude: string[]): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const normalizedPath = normalizePath(fullPath) + '/';

      // Check exclude
      const isExcluded = exclude.some((pattern) => {
        const normalizedPattern = pattern.toLowerCase();
        return normalizedPath.toLowerCase().includes(normalizedPattern);
      });
      if (isExcluded) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...walkDirectory(fullPath, exclude));
        } else if (stat.isFile()) {
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
