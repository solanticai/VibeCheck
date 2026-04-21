import { existsSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Rule, RuleResult, VGuardPlugin, Preset } from '../../../src/types.js';

const DEFAULT_SBOM_PATH = '.vguard/sbom/cyclonedx.json';
const MANIFEST_CANDIDATES = ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml'];

function sbomPath(projectRoot: string, override?: string): string {
  return join(projectRoot, override ?? DEFAULT_SBOM_PATH);
}

function newestManifestMtime(projectRoot: string): number {
  let latest = 0;
  for (const name of MANIFEST_CANDIDATES) {
    try {
      const p = join(projectRoot, name);
      if (!existsSync(p)) continue;
      const m = statSync(p).mtimeMs;
      if (m > latest) latest = m;
    } catch {
      // ignore
    }
  }
  return latest;
}

function trySyft(projectRoot: string, outputPath: string): boolean {
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    const r = spawnSync('syft', [projectRoot, '-o', `cyclonedx-json=${outputPath}`], {
      encoding: 'utf-8',
      timeout: 60_000,
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

function tryMinimalNpmSbom(projectRoot: string, outputPath: string): boolean {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
    };
    const components = Object.entries(pkg.dependencies ?? {}).map(([name, version]) => ({
      type: 'library',
      name,
      version: String(version).replace(/^[\^~]/, ''),
      purl: `pkg:npm/${name}@${String(version).replace(/^[\^~]/, '')}`,
    }));
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      serialNumber: `urn:uuid:${Date.now()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        component: {
          type: 'application',
          name: pkg.name ?? 'app',
          version: pkg.version ?? '0.0.0',
        },
      },
      components,
    };
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(sbom, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function regenerateSbom(projectRoot: string, override?: string): boolean {
  const out = sbomPath(projectRoot, override);
  return trySyft(projectRoot, out) || tryMinimalNpmSbom(projectRoot, out);
}

const sbomUpToDate: Rule = {
  id: 'sbom/up-to-date',
  name: 'SBOM Up To Date',
  description: 'Warns when .vguard/sbom/cyclonedx.json is older than the newest dep manifest.',
  severity: 'warn',
  events: ['Stop'],
  editCheck: false,
  check: (context): RuleResult => {
    const ruleId = 'sbom/up-to-date';
    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      const cfg = context.projectConfig.rules.get(ruleId);
      const overridePath = cfg?.options?.sbomPath as string | undefined;
      const autoRegen = (cfg?.options?.autoRegenerate as boolean) ?? false;
      const out = sbomPath(repoRoot, overridePath);
      const manifestTime = newestManifestMtime(repoRoot);
      if (manifestTime === 0) return { status: 'pass', ruleId };
      const sbomTime = existsSync(out) ? statSync(out).mtimeMs : 0;
      if (sbomTime >= manifestTime) return { status: 'pass', ruleId };
      if (autoRegen && regenerateSbom(repoRoot, overridePath)) {
        return { status: 'pass', ruleId };
      }
      return {
        status: 'warn',
        ruleId,
        message: `SBOM at ${out} is older than your dependency manifest.`,
        fix: 'Run `syft . -o cyclonedx-json=.vguard/sbom/cyclonedx.json` or set autoRegenerate:true in rule options.',
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const sbomSigValid: Rule = {
  id: 'sbom/sig-valid',
  name: 'SBOM Signature Valid',
  description: 'Warns when .sig file for the SBOM is missing or older than the SBOM itself.',
  severity: 'info',
  events: ['Stop'],
  editCheck: false,
  check: (context): RuleResult => {
    const ruleId = 'sbom/sig-valid';
    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };
      const out = sbomPath(repoRoot);
      if (!existsSync(out)) return { status: 'pass', ruleId };
      const sigPath = out + '.sig';
      if (!existsSync(sigPath)) {
        return {
          status: 'warn',
          ruleId,
          message: 'SBOM exists but has no .sig file.',
          fix: 'Sign with `cosign sign-blob .vguard/sbom/cyclonedx.json --output-signature .vguard/sbom/cyclonedx.json.sig`.',
        };
      }
      if (statSync(sigPath).mtimeMs < statSync(out).mtimeMs) {
        return {
          status: 'warn',
          ruleId,
          message: 'SBOM .sig is older than the SBOM it signs.',
          fix: 'Re-sign after regenerating the SBOM.',
        };
      }
      return { status: 'pass', ruleId };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const euCra2026: Preset = {
  id: 'eu-cra-2026',
  name: 'EU CRA 2026',
  description: 'EU Cyber Resilience Act preset: SBOM presence + freshness.',
  version: '0.1.0',
  rules: {
    'sbom/up-to-date': { severity: 'warn', autoRegenerate: false },
    'sbom/sig-valid': true,
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-compliance-sbom',
  version: '0.1.0',
  rules: [sbomUpToDate, sbomSigValid],
  presets: [euCra2026],
};

export default plugin;
export { plugin, sbomUpToDate, sbomSigValid, euCra2026, regenerateSbom };
