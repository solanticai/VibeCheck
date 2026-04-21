import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { aggregateReport } from '../../report/aggregator.js';
import { generateMarkdownReport, saveReport } from '../../report/markdown.js';
import { generateHtmlReport, saveHtmlReport } from '../../report/html.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { info } from '../ui/log.js';

export async function reportCommand(options?: { output?: string; format?: string }): Promise<void> {
  const projectRoot = process.cwd();

  printBanner('Report', 'Generating quality dashboard');

  const data = aggregateReport(projectRoot);

  if (data.totalHits === 0) {
    info(color.dim('  No rule hit data found. Run VGuard hooks first to collect data.'));
    info(color.dim('  Data is recorded automatically when hooks execute.\n'));
    return;
  }

  const format = options?.format ?? 'md';
  const writtenPaths: string[] = [];

  if (format === 'json') {
    const json = JSON.stringify(data, null, 2);
    if (options?.output) {
      await mkdir(dirname(options.output), { recursive: true });
      await writeFile(options.output, json, 'utf-8');
      writtenPaths.push(options.output);
    } else {
      process.stdout.write(json + '\n');
    }
  } else if (format === 'html') {
    const html = generateHtmlReport(data);
    if (options?.output) {
      await mkdir(dirname(options.output), { recursive: true });
      await writeFile(options.output, html, 'utf-8');
      writtenPaths.push(options.output);
    } else {
      writtenPaths.push(await saveHtmlReport(html, projectRoot));
    }
  } else if (format === 'all') {
    // Ignore --output when writing all formats; use default locations.
    const markdown = generateMarkdownReport(data);
    writtenPaths.push(await saveReport(markdown, projectRoot));

    const html = generateHtmlReport(data);
    writtenPaths.push(await saveHtmlReport(html, projectRoot));

    const jsonPath = join(projectRoot, '.vguard', 'reports', 'quality-report.json');
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    writtenPaths.push(jsonPath);
  } else {
    // default: md
    const markdown = generateMarkdownReport(data);
    if (options?.output) {
      await mkdir(dirname(options.output), { recursive: true });
      await writeFile(options.output, markdown, 'utf-8');
      writtenPaths.push(options.output);
    } else {
      writtenPaths.push(await saveReport(markdown, projectRoot));
    }
  }

  for (const path of writtenPaths) {
    info(`  ${color.green(glyph('pass'))} Report saved to ${path}`);
  }

  info(`  ${color.bold('Total rule executions:')} ${data.totalHits}`);

  const score = data.debtScore;
  const scoreColor = score >= 80 ? color.red : score >= 50 ? color.yellow : color.green;
  info(`  ${color.bold('Technical debt score:')}  ${scoreColor(`${score}/100`)}\n`);
}
