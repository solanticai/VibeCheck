import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Supported config file names in priority order */
const CONFIG_FILES = [
  'vguard.config.ts',
  'vguard.config.js',
  'vguard.config.mjs',
  '.vguardrc.json',
];

export interface DiscoveredConfig {
  /** Absolute path to the config file */
  path: string;
  /** Config file format */
  format: 'typescript' | 'javascript' | 'json';
}

/**
 * Cache of discovery results per projectRoot. Most CLI commands call
 * `discoverConfigFile(process.cwd())` once; a few — doctor, generate,
 * lint — call it from multiple helpers during one invocation. The
 * cache avoids re-hitting the filesystem for each call. Call
 * `clearDiscoveryCache()` in tests that create or delete config
 * files between assertions.
 */
const discoveryCache = new Map<string, DiscoveredConfig | null>();

/**
 * Clear the discovery cache. Intended for tests or for commands like
 * `vguard init` that change the on-disk config layout during the same
 * process.
 */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}

/**
 * Find the VGuard config file in a project root.
 * Searches in priority order: .ts > .js > .mjs > .json > package.json#vguard
 */
export function discoverConfigFile(projectRoot: string): DiscoveredConfig | null {
  const cached = discoveryCache.get(projectRoot);
  if (cached !== undefined) return cached;

  const result = discoverConfigFileUncached(projectRoot);
  discoveryCache.set(projectRoot, result);
  return result;
}

function discoverConfigFileUncached(projectRoot: string): DiscoveredConfig | null {
  for (const filename of CONFIG_FILES) {
    const fullPath = join(projectRoot, filename);
    if (existsSync(fullPath)) {
      const format = filename.endsWith('.json')
        ? 'json'
        : filename.endsWith('.ts')
          ? 'typescript'
          : 'javascript';
      return { path: fullPath, format };
    }
  }

  // Check package.json for "vguard" field
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      if (pkg.vguard) {
        return { path: pkgPath, format: 'json' };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

/**
 * Read the raw config from a discovered config file.
 * For TypeScript/JavaScript files, uses jiti for runtime loading.
 * For JSON files, parses directly.
 */
export async function readRawConfig(
  discovered: DiscoveredConfig,
): Promise<Record<string, unknown>> {
  if (discovered.format === 'json') {
    const raw = await readFile(discovered.path, 'utf-8');
    const parsed = JSON.parse(raw);

    // If it's package.json, extract the "vguard" field
    if (discovered.path.endsWith('package.json')) {
      return parsed.vguard ?? {};
    }
    return parsed;
  }

  // TypeScript or JavaScript — use jiti for runtime loading
  const { createJiti } = await import('jiti');
  const jiti = createJiti(discovered.path, {
    interopDefault: true,
  });
  const mod = await jiti.import(discovered.path);

  // Handle default export
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: Record<string, unknown> }).default;
  }
  return mod as Record<string, unknown>;
}
