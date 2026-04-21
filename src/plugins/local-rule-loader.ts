import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Rule } from '../types.js';
import { registerRule, hasRule } from '../engine/registry.js';

const LOCAL_RULES_DIR = '.vguard/rules/custom';
const SUPPORTED_EXTENSIONS = new Set(['.ts', '.js', '.mjs']);
const MAX_LOCAL_SEVERITY: 'block' | 'warn' | 'info' = 'warn';

export interface LocalRuleLoadResult {
  /** Files that were successfully loaded and registered. */
  loaded: string[];
  /** Files that could not be loaded, with the reason why. */
  errors: Array<{ file: string; error: string }>;
  /** Number of rules registered. */
  rulesAdded: number;
  /** Whether the `.vguard/rules/custom/` directory existed at all. */
  directoryExists: boolean;
  /** Files that were downgraded from `block` to `warn`. */
  downgraded: string[];
}

interface LoadOptions {
  /** Skip the on-disk scan entirely (used when config.localRules === false). */
  disabled?: boolean;
}

/**
 * Discover, validate, and register project-local rule files under
 * `<projectRoot>/.vguard/rules/custom/`.
 *
 * Trust model: local rules are authored by the same people who author the
 * repo's source code, so we trust them to run — but they have not been
 * through the npm publish process, so we cap their effective severity at
 * `warn`. Blocking severity continues to require a published plugin via
 * `config.plugins`. Block-severity local rules are downgraded, not
 * refused, so a user who moved a rule into `.vguard/rules/custom/` to
 * iterate on it gets feedback instead of silence.
 *
 * Fail-open: import failures, shape-validation errors, and registry
 * conflicts are recorded in the returned `errors` array but never throw.
 * The caller (e.g. `vguard doctor`) decides whether to surface them.
 */
export async function loadLocalRules(
  projectRoot: string,
  options: LoadOptions = {},
): Promise<LocalRuleLoadResult> {
  const result: LocalRuleLoadResult = {
    loaded: [],
    errors: [],
    rulesAdded: 0,
    directoryExists: false,
    downgraded: [],
  };

  const dir = join(projectRoot, LOCAL_RULES_DIR);
  if (!existsSync(dir)) return result;
  result.directoryExists = true;

  if (options.disabled) return result;

  const files = collectRuleFiles(dir);
  if (files.length === 0) return result;

  const { createJiti } = await import('jiti');
  const jiti = createJiti(join(projectRoot, 'package.json'), {
    interopDefault: true,
  });

  for (const file of files) {
    const relPath = relative(projectRoot, file);
    try {
      const mod = (await jiti.import(file)) as Record<string, unknown>;
      const exported =
        mod && typeof mod === 'object' && 'default' in mod
          ? (mod as { default: unknown }).default
          : mod;

      const validation = validateLocalRule(exported, relPath);
      if (!validation.valid || !validation.rule) {
        result.errors.push({ file: relPath, error: validation.errors.join('; ') });
        continue;
      }

      let rule = validation.rule;
      if (rule.severity === 'block') {
        rule = { ...rule, severity: MAX_LOCAL_SEVERITY };
        result.downgraded.push(relPath);
      }

      if (hasRule(rule.id)) {
        result.errors.push({
          file: relPath,
          error: `rule id "${rule.id}" conflicts with an existing rule (built-in or plugin)`,
        });
        continue;
      }

      registerRule(rule);
      result.loaded.push(relPath);
      result.rulesAdded += 1;
    } catch (err) {
      result.errors.push({
        file: relPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

function collectRuleFiles(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        out.push(...collectRuleFiles(full));
        continue;
      }
      if (!stat.isFile()) continue;
      const lower = entry.toLowerCase();
      if (lower.endsWith('.d.ts')) continue;
      const dot = lower.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = lower.slice(dot);
      if (SUPPORTED_EXTENSIONS.has(ext)) out.push(full);
    }
  } catch {
    // Unreadable subdirectories are skipped quietly.
  }
  return out;
}

interface LocalRuleValidation {
  valid: boolean;
  errors: string[];
  rule?: Rule;
}

/**
 * Shape-check an imported module's default export against the `Rule`
 * contract. Reused checks mirror `validatePlugin` so local-rule authors
 * see the same error surface as plugin authors.
 */
export function validateLocalRule(candidate: unknown, label: string): LocalRuleValidation {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: [`${label}: default export is not an object`] };
  }

  const rule = candidate as Partial<Rule>;

  if (!rule.id || typeof rule.id !== 'string') {
    errors.push(`${label}: rule is missing "id" string field`);
  } else if (!rule.id.includes('/')) {
    errors.push(`${label}: rule id "${rule.id}" must follow category/name format`);
  }

  if (!rule.name || typeof rule.name !== 'string') {
    errors.push(`${label}: rule "${rule.id ?? '?'}" is missing "name" field`);
  }

  if (!rule.check || typeof rule.check !== 'function') {
    errors.push(`${label}: rule "${rule.id ?? '?'}" is missing "check" function`);
  }

  if (!Array.isArray(rule.events) || rule.events.length === 0) {
    errors.push(`${label}: rule "${rule.id ?? '?'}" must specify at least one event`);
  }

  if (!rule.severity || !['block', 'warn', 'info'].includes(rule.severity)) {
    errors.push(`${label}: rule "${rule.id ?? '?'}" has invalid or missing severity`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], rule: rule as Rule };
}
