import type { ScanResult } from '../../engine/scanner.js';

/**
 * Format scan results as GitHub Actions annotations.
 * These appear inline on PR diffs.
 */
export function formatGitHubActions(result: ScanResult): string {
  const lines: string[] = [];

  for (const issue of result.issues) {
    const level = issue.severity === 'block' ? 'error' : 'warning';
    const file = issue.filePath.replace(/\\/g, '/');
    lines.push(`::${level} file=${file},title=${issue.ruleId}::${issue.message}`);
  }

  if (result.issues.length === 0) {
    lines.push('::notice::VibeCheck: No issues found');
  }

  return lines.join('\n');
}
