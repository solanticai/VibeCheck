import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { aggregateReport } from '../../report/aggregator.js';
import { generateMarkdownReport, saveReport } from '../../report/markdown.js';

export async function reportCommand(options?: {
  output?: string;
  format?: string;
}): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VGuard Report — Generating quality dashboard...\n');

  const data = aggregateReport(projectRoot);

  if (data.totalHits === 0) {
    console.log('  No rule hit data found. Run VGuard hooks first to collect data.');
    console.log('  Data is recorded automatically when hooks execute.\n');
    return;
  }

  const format = options?.format ?? 'md';

  if (format === 'json') {
    const json = JSON.stringify(data, null, 2);

    if (options?.output) {
      await mkdir(dirname(options.output), { recursive: true });
      await writeFile(options.output, json, 'utf-8');
      console.log(`  Report saved to ${options.output}`);
    } else {
      console.log(json);
    }
    return;
  }

  // Default: markdown
  const markdown = generateMarkdownReport(data);

  if (options?.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, markdown, 'utf-8');
    console.log(`  Report saved to ${options.output}`);
  } else {
    const outputPath = await saveReport(markdown, projectRoot);
    console.log(`  Report saved to ${outputPath}`);
  }

  console.log(`  Total rule executions: ${data.totalHits}`);
  console.log(`  Technical debt score: ${data.debtScore}/100\n`);
}
