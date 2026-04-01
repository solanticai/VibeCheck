import type { ScanResult } from '../../engine/scanner.js';

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
