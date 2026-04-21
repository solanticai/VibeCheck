import { spawnSync } from 'node:child_process';
import type { Rule, RuleResult, VGuardPlugin } from '../../../src/types.js';

function binaryAvailable(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['--version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

function runGitleaks(filePath: string): { hits: string[] } {
  const r = spawnSync(
    'gitleaks',
    [
      'detect',
      '--no-git',
      '--source',
      filePath,
      '--report-format',
      'json',
      '--report-path',
      '/dev/stdout',
    ],
    { encoding: 'utf-8', timeout: 10_000 },
  );
  if (r.status !== 0 && r.status !== 1) return { hits: [] };
  try {
    const out = JSON.parse(r.stdout || '[]') as Array<{ RuleID?: string }>;
    return { hits: out.map((x) => x.RuleID ?? 'unknown') };
  } catch {
    return { hits: [] };
  }
}

function runTrufflehog(filePath: string): { hits: string[] } {
  const r = spawnSync('trufflehog', ['filesystem', filePath, '--json', '--only-verified'], {
    encoding: 'utf-8',
    timeout: 20_000,
  });
  if (r.status !== 0 && r.status !== 1) return { hits: [] };
  const hits: string[] = [];
  for (const line of (r.stdout || '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as { DetectorName?: string };
      if (obj.DetectorName) hits.push(obj.DetectorName);
    } catch {
      // skip
    }
  }
  return { hits };
}

const deepSecretScan: Rule = {
  id: 'secret-scanner-ext/deep-scan',
  name: 'Deep Secret Scan',
  description: 'Runs gitleaks/trufflehog against a written file for verified-secret detection.',
  severity: 'block',
  events: ['PostToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'secret-scanner-ext/deep-scan';
    try {
      const filePath = (context.toolInput.file_path as string) ?? '';
      if (!filePath) return { status: 'pass', ruleId };

      if (binaryAvailable('trufflehog')) {
        const { hits } = runTrufflehog(filePath);
        if (hits.length > 0) {
          return {
            status: 'block',
            ruleId,
            message: `Trufflehog verified secret(s): ${hits.join(', ')}.`,
            fix: 'Rotate the credential and remove from the commit.',
          };
        }
      } else if (binaryAvailable('gitleaks')) {
        const { hits } = runGitleaks(filePath);
        if (hits.length > 0) {
          return {
            status: 'block',
            ruleId,
            message: `Gitleaks hit: ${hits.join(', ')}.`,
            fix: 'Rotate the credential and remove from the commit.',
          };
        }
      }
      return { status: 'pass', ruleId };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-secret-scanner-ext',
  version: '0.1.0',
  rules: [deepSecretScan],
};

export default plugin;
export { plugin, deepSecretScan, binaryAvailable };
