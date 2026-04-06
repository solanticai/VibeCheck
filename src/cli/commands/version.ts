import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function versionCommand(): void {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    console.log(`vguard v${pkg.version}`);
  } catch {
    console.log('vguard v0.0.0 (unable to read version)');
  }
}
