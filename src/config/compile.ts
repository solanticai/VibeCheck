import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { CloudConfig, ResolvedConfig, ResolvedRuleConfig } from '../types.js';

/** Path for pre-compiled config cache (relative to project root) */
const CACHE_PATH = '.vguard/cache/resolved-config.json';

/**
 * Serializable form of `ResolvedConfig` (Map → object).
 *
 * `localRulePaths` is populated by `vguard generate` from the
 * `.vguard/rules/custom/` scan and replayed at hook time so the hook
 * path doesn't have to re-walk the directory on every tool call.
 * Absent on pre-2026-04 caches — readers must treat it as optional.
 */
interface SerializedConfig {
  presets: string[];
  agents: string[];
  rules: Record<string, ResolvedRuleConfig>;
  cloud?: CloudConfig;
  /** Project-relative paths of local rules to load at hook time. */
  localRulePaths?: string[];
}

/**
 * Extra metadata that lives alongside the serialized ResolvedConfig in
 * `.vguard/cache/resolved-config.json` but that isn't part of the
 * runtime `ResolvedConfig` type. Kept on the serialized side so the
 * core engine interface stays clean.
 */
export interface CompiledConfigMetadata {
  /** Project-relative paths of local rules to replay at hook time. */
  localRulePaths?: string[];
}

/**
 * Serialize a ResolvedConfig to a JSON-compatible object.
 * Converts the rules Map to a plain object.
 */
export function serializeConfig(
  config: ResolvedConfig,
  metadata: CompiledConfigMetadata = {},
): SerializedConfig {
  const rules: Record<string, ResolvedRuleConfig> = {};
  for (const [id, ruleConfig] of config.rules) {
    rules[id] = ruleConfig;
  }
  return {
    presets: config.presets,
    agents: config.agents,
    rules,
    cloud: config.cloud,
    ...(metadata.localRulePaths ? { localRulePaths: metadata.localRulePaths } : {}),
  };
}

/**
 * Deserialize a JSON object back to a ResolvedConfig.
 */
export function deserializeConfig(serialized: SerializedConfig): ResolvedConfig {
  const rules = new Map<string, ResolvedRuleConfig>();
  for (const [id, ruleConfig] of Object.entries(serialized.rules)) {
    rules.set(id, ruleConfig);
  }
  return {
    presets: serialized.presets,
    agents: serialized.agents as ResolvedConfig['agents'],
    rules,
    cloud: serialized.cloud,
  };
}

/**
 * Pre-compile resolved config to JSON for fast hook loading.
 * Written to .vguard/cache/resolved-config.json.
 *
 * Pass `metadata.localRulePaths` to embed the result of a prior
 * `loadLocalRules(projectRoot)` call, so the hook runtime can replay
 * the same imports without re-scanning `.vguard/rules/custom/`.
 */
export async function compileConfig(
  config: ResolvedConfig,
  projectRoot: string,
  metadata: CompiledConfigMetadata = {},
): Promise<string> {
  const outputPath = join(projectRoot, CACHE_PATH);
  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const serialized = serializeConfig(config, metadata);
  const json = JSON.stringify(serialized, null, 2);
  await writeFile(outputPath, json, 'utf-8');

  return outputPath;
}

/**
 * Load pre-compiled config from cache.
 * Returns null if cache doesn't exist or is invalid.
 */
export async function loadCompiledConfig(projectRoot: string): Promise<ResolvedConfig | null> {
  const cachePath = join(projectRoot, CACHE_PATH);
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(cachePath, 'utf-8');
    const serialized = JSON.parse(raw) as SerializedConfig;
    return deserializeConfig(serialized);
  } catch {
    return null;
  }
}

/**
 * Load the pre-compiled config together with the metadata fields that
 * aren't part of the runtime `ResolvedConfig`. Returns null on any
 * read / parse error, same as `loadCompiledConfig`.
 */
export async function loadCompiledConfigWithMetadata(
  projectRoot: string,
): Promise<{ config: ResolvedConfig; metadata: CompiledConfigMetadata } | null> {
  const cachePath = join(projectRoot, CACHE_PATH);
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(cachePath, 'utf-8');
    const serialized = JSON.parse(raw) as SerializedConfig;
    const config = deserializeConfig(serialized);
    const metadata: CompiledConfigMetadata = serialized.localRulePaths
      ? { localRulePaths: serialized.localRulePaths }
      : {};
    return { config, metadata };
  } catch {
    return null;
  }
}
