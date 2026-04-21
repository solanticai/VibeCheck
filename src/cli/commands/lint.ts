import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { loadLocalRules } from '../../plugins/local-rule-loader.js';
import { scanProject } from '../../engine/scanner.js';
import { formatText } from '../formatters/text.js';
import { formatGitHubActions } from '../formatters/github-actions.js';
import { formatJson } from '../formatters/json.js';
import { formatNdjson } from '../formatters/ndjson.js';
import { startSpinner } from '../ui/spinner.js';
import type { VGuardConfig } from '../../types.js';
import { error } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

export async function lintCommand(options: { format?: string }): Promise<void> {
  const projectRoot = process.cwd();

  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    error('No VGuard config found. Run `vguard init` first.');
    process.exit(EXIT.NO_INPUT);
  }

  const format = options.format ?? 'text';
  const machineOutput = format === 'json' || format === 'github-actions' || format === 'ndjson';

  await loadLocalRules(projectRoot);
  const rawConfig = await readRawConfig(discovered);
  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(rawConfig as VGuardConfig, presetMap);

  const spinner = machineOutput ? null : startSpinner('Scanning project');
  const result = await scanProject({
    rootDir: projectRoot,
    config: resolvedConfig,
  });
  spinner?.succeed(`Scanned ${result.filesScanned} files`);

  let output: string;
  switch (format) {
    case 'github-actions':
      output = formatGitHubActions(result);
      break;
    case 'json':
      output = formatJson(result);
      break;
    case 'ndjson':
      output = formatNdjson(result);
      break;
    default:
      output = formatText(result);
  }

  process.stdout.write(output.endsWith('\n') ? output : output + '\n');

  if (result.hasBlockingIssues) {
    process.exit(EXIT.LINT_BLOCKING);
  }
}
