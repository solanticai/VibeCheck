import { spawnSync } from 'node:child_process';
import type { Rule, RuleResult, VGuardPlugin, Preset } from '../../../src/types.js';
import { getExtension } from '../../../src/utils/path.js';

function binAvailable(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['--version'], { stdio: 'ignore', timeout: 5_000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function semgrepScan(filePath: string): string[] {
  try {
    const r = spawnSync('semgrep', ['--config=auto', '--json', '--quiet', filePath], {
      encoding: 'utf-8',
      timeout: 30_000,
    });
    if (r.status !== 0 && r.status !== 1) return [];
    const parsed = JSON.parse(r.stdout || '{}') as { results?: Array<{ check_id?: string }> };
    return (parsed.results ?? []).map((x) => x.check_id ?? 'unknown');
  } catch {
    return [];
  }
}

function banditScan(filePath: string): string[] {
  try {
    const r = spawnSync('bandit', ['-f', 'json', filePath], {
      encoding: 'utf-8',
      timeout: 30_000,
    });
    if (r.status !== 0 && r.status !== 1) return [];
    const parsed = JSON.parse(r.stdout || '{}') as { results?: Array<{ test_id?: string }> };
    return (parsed.results ?? []).map((x) => x.test_id ?? 'unknown');
  } catch {
    return [];
  }
}

function brakemanScan(projectRoot: string): string[] {
  try {
    const r = spawnSync('brakeman', ['-q', '-f', 'json', projectRoot], {
      encoding: 'utf-8',
      timeout: 60_000,
    });
    if (r.status !== 0 && r.status !== 3) return [];
    const parsed = JSON.parse(r.stdout || '{}') as { warnings?: Array<{ warning_type?: string }> };
    return (parsed.warnings ?? []).map((x) => x.warning_type ?? 'unknown');
  } catch {
    return [];
  }
}

function sobelowScan(projectRoot: string): string[] {
  try {
    const r = spawnSync('mix', ['sobelow', '--format', 'json'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 60_000,
    });
    if (r.status !== 0 && r.status !== 1) return [];
    const parsed = JSON.parse(r.stdout || '{}') as {
      findings?: { high_confidence?: unknown[]; medium_confidence?: unknown[] };
    };
    const all = [
      ...(parsed.findings?.high_confidence ?? []),
      ...(parsed.findings?.medium_confidence ?? []),
    ];
    return all.map(() => 'sobelow');
  } catch {
    return [];
  }
}

function makeWrapperRule(id: string, runner: 'semgrep' | 'bandit' | 'brakeman' | 'sobelow'): Rule {
  return {
    id,
    name: id,
    description: `Wraps ${runner} as a VGuard rule. No-op when the binary is not installed.`,
    severity: 'warn',
    events: ['PostToolUse'],
    match: { tools: ['Write', 'Edit'] },
    editCheck: false,
    check: (context): RuleResult => {
      const filePath = (context.toolInput.file_path as string) ?? '';
      const repoRoot = context.gitContext.repoRoot;
      if (!filePath || !repoRoot) return { status: 'pass', ruleId: id };
      const ext = getExtension(filePath);

      if (runner === 'semgrep') {
        if (!['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rb', 'php'].includes(ext)) {
          return { status: 'pass', ruleId: id };
        }
        if (!binAvailable('semgrep')) return { status: 'pass', ruleId: id };
        const hits = semgrepScan(filePath);
        if (hits.length === 0) return { status: 'pass', ruleId: id };
        return {
          status: 'warn',
          ruleId: id,
          message: `semgrep: ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? '…' : ''}`,
          fix: 'Run `semgrep --config=auto` locally to see full findings.',
        };
      }
      if (runner === 'bandit') {
        if (ext !== 'py') return { status: 'pass', ruleId: id };
        if (!binAvailable('bandit')) return { status: 'pass', ruleId: id };
        const hits = banditScan(filePath);
        if (hits.length === 0) return { status: 'pass', ruleId: id };
        return {
          status: 'warn',
          ruleId: id,
          message: `bandit: ${hits.slice(0, 3).join(', ')}`,
          fix: 'Run `bandit -r .` locally for full findings.',
        };
      }
      if (runner === 'brakeman') {
        if (ext !== 'rb') return { status: 'pass', ruleId: id };
        if (!binAvailable('brakeman')) return { status: 'pass', ruleId: id };
        const hits = brakemanScan(repoRoot);
        if (hits.length === 0) return { status: 'pass', ruleId: id };
        return {
          status: 'warn',
          ruleId: id,
          message: `brakeman: ${hits.slice(0, 3).join(', ')}`,
          fix: 'Run `brakeman` locally for full findings.',
        };
      }
      if (runner === 'sobelow') {
        if (ext !== 'ex' && ext !== 'exs') return { status: 'pass', ruleId: id };
        if (!binAvailable('mix')) return { status: 'pass', ruleId: id };
        const hits = sobelowScan(repoRoot);
        if (hits.length === 0) return { status: 'pass', ruleId: id };
        return {
          status: 'warn',
          ruleId: id,
          message: `sobelow: ${hits.length} finding(s)`,
          fix: 'Run `mix sobelow` locally for full findings.',
        };
      }
      return { status: 'pass', ruleId: id };
    },
  };
}

const sastSemgrep = makeWrapperRule('sast/semgrep', 'semgrep');
const sastBandit = makeWrapperRule('sast/bandit', 'bandit');
const sastBrakeman = makeWrapperRule('sast/brakeman', 'brakeman');
const sastSobelow = makeWrapperRule('sast/sobelow', 'sobelow');

const sastStandard: Preset = {
  id: 'sast-standard',
  name: 'SAST Standard',
  description:
    'Activates semgrep/bandit/brakeman/sobelow wrapper rules (each no-ops if binary absent).',
  version: '0.1.0',
  rules: {
    'sast/semgrep': true,
    'sast/bandit': true,
    'sast/brakeman': true,
    'sast/sobelow': true,
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-sast-bridge',
  version: '0.1.0',
  rules: [sastSemgrep, sastBandit, sastBrakeman, sastSobelow],
  presets: [sastStandard],
};

export default plugin;
export { plugin, sastSemgrep, sastBandit, sastBrakeman, sastSobelow, sastStandard, binAvailable };
