import { vguardConfigSchema } from './schema.js';
import { discoverConfigFile, readRawConfig } from './discovery.js';
import type { VGuardConfig } from '../types.js';
import type { ZodIssue } from 'zod';

/**
 * Thrown by `loadValidatedConfig` when the user's config fails Zod
 * validation. Surfaces the issue list so CLI commands can format a
 * useful `path.to.field: expected X, got Y` message instead of the
 * raw schema error.
 */
export class ConfigValidationError extends Error {
  readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    const formatted = issues
      .map((i) => `  - ${i.path.length > 0 ? i.path.join('.') : '<root>'}: ${i.message}`)
      .join('\n');
    super(`Invalid VGuard config:\n${formatted}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

/**
 * Discover, read, and Zod-validate the user config.
 *
 * Every CLI command that previously cast `readRawConfig()` output to
 * `VGuardConfig` should go through this helper instead: a hand-edited
 * config with a typo in `rules`, a stringified number under
 * `cloud.streaming.batchSize`, or a misspelled `agents` entry now fails
 * loud with a readable error at the one place that was designed to
 * catch it — rather than surfacing as a TypeError deep in rule
 * execution.
 *
 * @param projectRoot  Project root (default: `process.cwd()`).
 * @throws Error       When no config file is found (caller should treat
 *                     as "not initialised").
 * @throws ConfigValidationError  When the config is malformed.
 */
export async function loadValidatedConfig(
  projectRoot: string = process.cwd(),
): Promise<VGuardConfig> {
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    throw new Error('No VGuard config found. Run `vguard init` first.');
  }

  const raw = await readRawConfig(discovered);
  const parsed = vguardConfigSchema.safeParse(raw);

  if (!parsed.success) {
    throw new ConfigValidationError(parsed.error.issues);
  }

  return parsed.data as VGuardConfig;
}
