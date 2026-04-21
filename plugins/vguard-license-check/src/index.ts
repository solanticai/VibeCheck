import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult, VGuardPlugin, Preset } from '../../../src/types.js';

function readLicenses(projectRoot: string): Record<string, string> {
  // Requires `license-checker` (npm i -g license-checker) — fails open if absent.
  try {
    const r = spawnSync('npx', ['-y', 'license-checker', '--json', '--production'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 30_000,
    });
    if (r.status !== 0) return {};
    const parsed = JSON.parse(r.stdout || '{}') as Record<string, { licenses?: string }>;
    const out: Record<string, string> = {};
    for (const [pkg, meta] of Object.entries(parsed)) {
      out[pkg] = meta.licenses ?? 'UNKNOWN';
    }
    return out;
  } catch {
    return {};
  }
}

const licenseAllowlist: Rule = {
  id: 'license/allowlist',
  name: 'License Allowlist',
  description:
    'Checks dep licenses against configured allow/deny lists at PreToolUse on package.json edits.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'license/allowlist';
    try {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!/package\.json$/.test(filePath)) return { status: 'pass', ruleId };
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      if (!existsSync(join(repoRoot, 'node_modules'))) return { status: 'pass', ruleId };

      const cfg = context.projectConfig.rules.get(ruleId);
      const allowed = new Set(
        (
          (cfg?.options?.allowedLicenses as string[]) ?? [
            'MIT',
            'Apache-2.0',
            'ISC',
            'BSD-3-Clause',
            'BSD-2-Clause',
            '0BSD',
            'CC0-1.0',
          ]
        ).map((s) => s.toUpperCase()),
      );
      const denied = new Set(
        ((cfg?.options?.deniedLicenses as string[]) ?? ['GPL-3.0', 'AGPL-3.0']).map((s) =>
          s.toUpperCase(),
        ),
      );

      const licenses = readLicenses(repoRoot);
      const violations: Array<{ pkg: string; license: string }> = [];
      for (const [pkg, license] of Object.entries(licenses)) {
        const up = license.toUpperCase();
        if (denied.has(up)) {
          violations.push({ pkg, license });
          continue;
        }
        if (!allowed.has(up) && up !== 'UNKNOWN') {
          violations.push({ pkg, license });
        }
      }
      if (violations.length === 0) return { status: 'pass', ruleId };

      return {
        status: 'warn',
        ruleId,
        message: `${violations.length} dependency license(s) outside allowlist.`,
        fix: `Review each: ${violations
          .slice(0, 5)
          .map((v) => `${v.pkg}=${v.license}`)
          .join(', ')}${violations.length > 5 ? ', …' : ''}.`,
        metadata: { violations: violations.slice(0, 20) },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const licensePermissive: Preset = {
  id: 'license-permissive',
  name: 'License (Permissive Only)',
  description: 'Allows only MIT/Apache-2.0/BSD/ISC/0BSD/CC0.',
  version: '0.1.0',
  rules: {
    'license/allowlist': {
      severity: 'warn',
      allowedLicenses: [
        'MIT',
        'Apache-2.0',
        'ISC',
        'BSD-3-Clause',
        'BSD-2-Clause',
        '0BSD',
        'CC0-1.0',
      ],
      deniedLicenses: ['GPL-3.0', 'AGPL-3.0', 'LGPL-3.0'],
    },
  },
};

const licenseCopyleftSafe: Preset = {
  id: 'license-copyleft-safe',
  name: 'License (Copyleft Safe)',
  description: 'Allows permissive + LGPL; denies GPL/AGPL.',
  version: '0.1.0',
  rules: {
    'license/allowlist': {
      severity: 'warn',
      allowedLicenses: [
        'MIT',
        'Apache-2.0',
        'ISC',
        'BSD-3-Clause',
        'BSD-2-Clause',
        'LGPL-2.1',
        'LGPL-3.0',
      ],
      deniedLicenses: ['GPL-3.0', 'AGPL-3.0'],
    },
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-license-check',
  version: '0.1.0',
  rules: [licenseAllowlist],
  presets: [licensePermissive, licenseCopyleftSafe],
};

export default plugin;
export { plugin, licenseAllowlist, licensePermissive, licenseCopyleftSafe };
