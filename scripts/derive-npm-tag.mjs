#!/usr/bin/env node
/**
 * Derive the npm dist-tag and prerelease flag from a version string.
 *
 * Used by:
 *   - `.github/workflows/publish.yml` (reads stdout when called with --json)
 *   - `tests/scripts/derive-npm-tag.test.ts` (imports `deriveNpmTag`)
 *
 * Single source of truth: bash logic previously inlined in publish.yml has
 * been replaced by a call to this script. The `__main__` block prints
 * GitHub-Actions-style `key=value` lines to stdout when invoked with no
 * args, which is what the workflow appends to $GITHUB_OUTPUT.
 *
 * Mapping (tested in the sibling .test.ts file):
 *   1.2.3           → { npm_tag: 'latest', is_prerelease: false }
 *   1.2.3-alpha.1   → { npm_tag: 'alpha',  is_prerelease: true  }
 *   1.2.3-beta.2    → { npm_tag: 'beta',   is_prerelease: true  }
 *   1.2.3-rc.0      → { npm_tag: 'rc',     is_prerelease: true  }
 *   1.2.3-next.4    → { npm_tag: 'next',   is_prerelease: true  }
 *   1.2.3-canary.0  → { npm_tag: 'canary', is_prerelease: true  }
 *   1.2.3+build.1   → { npm_tag: 'latest', is_prerelease: false } // build metadata only
 */

/**
 * @param {string} version
 * @returns {{ npm_tag: string, is_prerelease: boolean, tag: string }}
 */
export function deriveNpmTag(version) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('deriveNpmTag: expected a non-empty version string');
  }

  // Strip SemVer build metadata (`+...`) — it never affects dist-tag.
  const coreAndPre = version.split('+')[0] ?? version;

  // Split off prerelease suffix (everything after the first `-`).
  const dashIdx = coreAndPre.indexOf('-');
  const prerelease = dashIdx === -1 ? '' : coreAndPre.slice(dashIdx + 1).toLowerCase();

  const isPrerelease = prerelease.length > 0;
  let npmTag = 'latest';

  if (isPrerelease) {
    // Match the leading identifier of the prerelease label. Order here
    // mirrors the previous bash logic plus explicit next/canary handling.
    if (prerelease.startsWith('alpha')) npmTag = 'alpha';
    else if (prerelease.startsWith('beta')) npmTag = 'beta';
    else if (prerelease.startsWith('rc')) npmTag = 'rc';
    else if (prerelease.startsWith('next')) npmTag = 'next';
    else if (prerelease.startsWith('canary')) npmTag = 'canary';
    else npmTag = 'prerelease'; // unknown prerelease label — safe, non-latest default
  }

  return {
    npm_tag: npmTag,
    is_prerelease: isPrerelease,
    tag: `v${version}`,
  };
}

// CLI entry: read version from argv[2] or package.json, print GH-Actions output.
// Use fileURLToPath for cross-platform comparison (Windows `file:///C:/…` vs
// POSIX `file:///usr/…`).
async function isMainModule() {
  if (!process.argv[1]) return false;
  const { fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  try {
    return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
  } catch {
    return false;
  }
}

if (await isMainModule()) {
  const argvVersion = process.argv[2];
  let version = argvVersion;
  if (!version) {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    version = pkg.version;
  }
  const out = deriveNpmTag(version);
  const lines = [
    `version=${version}`,
    `tag=${out.tag}`,
    `npm_tag=${out.npm_tag}`,
    `is_prerelease=${out.is_prerelease}`,
  ];
  for (const line of lines) console.log(line);
}
