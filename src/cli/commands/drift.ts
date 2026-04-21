import { walkProject } from '../../learn/walker.js';
import { aggregateConventions } from '../../learn/aggregator.js';
import { freezeBaseline, readBaseline, computeDrift } from '../../learn/baseline.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { info, warn, error as logError } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

export async function driftCommand(options?: {
  freeze?: boolean;
  threshold?: number;
  format?: string;
}): Promise<void> {
  const projectRoot = process.cwd();
  const threshold = options?.threshold;
  const format = options?.format ?? 'text';

  printBanner('Drift', options?.freeze ? 'Freezing baseline' : 'Measuring drift vs baseline');

  const files = walkProject({ rootDir: projectRoot });
  const current = aggregateConventions(files, projectRoot);

  if (options?.freeze) {
    const path = await freezeBaseline(current, projectRoot);
    info(`  ${color.green('Baseline frozen')} → ${path}`);
    info(`  ${color.dim(`Patterns captured: ${current.allPatterns.length}`)}`);
    return;
  }

  const baseline = await readBaseline(projectRoot);
  if (!baseline) {
    logError('  No baseline found. Run `vguard drift --freeze` first.');
    process.exit(EXIT.CONFIG);
  }

  const drift = computeDrift(current, baseline);

  if (format === 'json') {
    process.stdout.write(
      JSON.stringify({ drift, baseline: { frozenAt: baseline.frozenAt } }, null, 2) + '\n',
    );
  } else {
    info(`  ${color.bold('Drift:')} ${drift.driftPercent}%`);
    info(
      `  ${color.bold('New patterns:')} ${drift.newPatterns.length}` +
        `  ${color.bold('Vanished:')} ${drift.vanishedPatterns.length}` +
        `  ${color.bold('Confidence changed:')} ${drift.changedConfidence.length}`,
    );
    if (drift.newPatterns.length > 0) {
      info('');
      info(`  ${color.yellow('New patterns:')}`);
      for (const p of drift.newPatterns.slice(0, 5)) {
        info(`    • ${p.description} (${p.type}, confidence ${p.confidence.toFixed(2)})`);
      }
    }
    if (drift.vanishedPatterns.length > 0) {
      info('');
      info(`  ${color.yellow('Vanished patterns:')}`);
      for (const p of drift.vanishedPatterns.slice(0, 5)) {
        info(`    • ${p.description} (${p.type})`);
      }
    }
  }

  if (typeof threshold === 'number' && drift.driftPercent >= threshold) {
    warn(`  Drift ${drift.driftPercent}% exceeds threshold ${threshold}%.`);
    process.exit(EXIT.LINT_BLOCKING ?? 1);
  }
}
