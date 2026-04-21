import { z } from 'zod';

/** Schema for per-rule configuration */
export const ruleConfigSchema = z.union([
  z.boolean(),
  z
    .object({
      severity: z.enum(['block', 'warn', 'info']).optional(),
    })
    .passthrough(),
]);

/** Schema for the learn section */
export const learnConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    scanPaths: z.array(z.string()).optional(),
    ignorePaths: z.array(z.string()).optional(),
  })
  .optional();

/** Schema for cloud streaming configuration — mirrors StreamingConfig */
export const streamingConfigSchema = z
  .object({
    batchSize: z.number().int().positive().optional(),
    flushIntervalMs: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict();

/** Schema for cloud sync settings */
export const cloudConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    projectId: z.string().optional(),
    autoSync: z.boolean().optional(),
    excludePaths: z.array(z.string()).optional(),
    streaming: streamingConfigSchema.optional(),
  })
  .strict()
  .optional();

/** Schema for monorepo configuration */
export const monorepoConfigSchema = z
  .object({
    packages: z.array(z.string()),
    overrides: z
      .record(
        z.string(),
        z.object({
          presets: z.array(z.string()).optional(),
          rules: z.record(z.string(), ruleConfigSchema).optional(),
        }),
      )
      .optional(),
  })
  .optional();

/** Valid npm package name pattern (scoped or unscoped) */
const npmPackageNamePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/** Schema for the complete user config (vguard.config.ts) */
export const vguardConfigSchema = z.object({
  profile: z.enum(['strict', 'standard', 'relaxed', 'audit']).optional(),
  presets: z.array(z.string()).optional(),
  agents: z.array(z.enum(['claude-code', 'cursor', 'codex', 'opencode'])).optional(),
  rules: z.record(z.string(), ruleConfigSchema).optional(),
  plugins: z.array(z.string().regex(npmPackageNamePattern, 'Invalid npm package name')).optional(),
  learn: learnConfigSchema,
  cloud: cloudConfigSchema,
  monorepo: monorepoConfigSchema,
  enforcement: z.enum(['fail-open', 'fail-closed', 'hybrid']).optional(),
});

export type ValidatedConfig = z.infer<typeof vguardConfigSchema>;

/**
 * @deprecated Use `vguardConfigSchema`. The former name reflected the
 * product's pre-rebrand identity; this re-export is kept for one minor
 * release to avoid breaking external callers.
 */
export const vibeCheckConfigSchema = vguardConfigSchema;
