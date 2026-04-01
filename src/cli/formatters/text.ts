import type { ScanResult } from '../../engine/scanner.js';

export function formatText(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`\nVibeCheck Lint — ${result.filesScanned} files scanned\n`);

  if (result.issues.length === 0) {
    lines.push('  No issues found.\n');
    return lines.join('\n');
  }

  // Group by file
  const byFile = new Map<string, typeof result.issues>();
  for (const issue of result.issues) {
    const existing = byFile.get(issue.filePath) ?? [];
    existing.push(issue);
    byFile.set(issue.filePath, existing);
  }

  for (const [filePath, issues] of byFile) {
    lines.push(`  ${filePath}`);
    for (const issue of issues) {
      const icon = issue.severity === 'block' ? 'x' : issue.severity === 'warn' ? '!' : 'i';
      lines.push(`    ${icon} [${issue.ruleId}] ${issue.message}`);
      if (issue.fix) {
        lines.push(`      Fix: ${issue.fix}`);
      }
    }
    lines.push('');
  }

  const blocks = result.issues.filter((i) => i.severity === 'block').length;
  const warns = result.issues.filter((i) => i.severity === 'warn').length;
  lines.push(
    `  ${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} (${blocks} blocking, ${warns} warnings)\n`,
  );

  return lines.join('\n');
}
