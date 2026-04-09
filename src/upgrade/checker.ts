import { execSync } from 'node:child_process';
import { isNewerVersion } from '../utils/semver.js';
import { isValidNpmPackageName } from '../utils/validation.js';

/** Version information for a package */
export interface VersionInfo {
  name: string;
  current: string;
  latest: string;
  hasUpdate: boolean;
}

/**
 * Check npm registry for newer versions of packages.
 *
 * Uses execSync (shell mode) because execFileSync cannot spawn .cmd
 * files on Windows without shell: true. Package names are validated
 * by isValidNpmPackageName before interpolation.
 */
export function checkForUpdates(packages: string[]): VersionInfo[] {
  const results: VersionInfo[] = [];

  for (const pkg of packages) {
    if (!isValidNpmPackageName(pkg)) {
      results.push({ name: pkg, current: 'unknown', latest: 'unknown', hasUpdate: false });
      continue;
    }

    try {
      // Get current installed version
      const currentRaw = execSync(`npm list ${pkg} --depth=0 --json`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const currentData = JSON.parse(currentRaw);
      const current = currentData.dependencies?.[pkg]?.version ?? 'unknown';

      // Get latest version from registry
      const latestRaw = execSync(`npm view ${pkg} version`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const latest = latestRaw.trim();

      results.push({
        name: pkg,
        current,
        latest,
        hasUpdate: current !== 'unknown' && latest !== 'unknown' && isNewerVersion(current, latest),
      });
    } catch {
      results.push({
        name: pkg,
        current: 'unknown',
        latest: 'unknown',
        hasUpdate: false,
      });
    }
  }

  return results;
}
