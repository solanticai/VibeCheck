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

/** Schema for cloud sync settings */
export const cloudConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    projectId: z.string().optional(),
    autoSync: z.boolean().optional(),
    excludePaths: z.array(z.string()).optional(),
  })
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

/** Schema for the complete user config (vibecheck.config.ts) */
export const vibeCheckConfigSchema = z.object({
  profile: z.enum(['strict', 'standard', 'relaxed', 'audit']).optional(),
  presets: z.array(z.string()).optional(),
  agents: z.array(z.enum(['claude-code', 'cursor', 'codex', 'opencode'])).optional(),
  rules: z.record(z.string(), ruleConfigSchema).optional(),
  plugins: z.array(z.string()).optional(),
  learn: learnConfigSchema,
  cloud: cloudConfigSchema,
  monorepo: monorepoConfigSchema,
});

export type ValidatedConfig = z.infer<typeof vibeCheckConfigSchema>;
