import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { scanProject } from '../../engine/scanner.js';
import { formatText } from '../formatters/text.js';
import { formatGitHubActions } from '../formatters/github-actions.js';
import { formatJson } from '../formatters/json.js';
import type { VibeCheckConfig } from '../../types.js';

export async function lintCommand(options: { format?: string }): Promise<void> {
  const projectRoot = process.cwd();

  // Load config
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    console.error('  No vibecheck config found. Run `vibecheck init` first.');
    process.exit(1);
  }

  const rawConfig = await readRawConfig(discovered);
  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(rawConfig as VibeCheckConfig, presetMap);

  // Scan project
  const result = await scanProject({
    rootDir: projectRoot,
    config: resolvedConfig,
  });

  // Format output
  const format = options.format ?? 'text';
  let output: string;

  switch (format) {
    case 'github-actions':
      output = formatGitHubActions(result);
      break;
    case 'json':
      output = formatJson(result);
      break;
    default:
      output = formatText(result);
  }

  console.log(output);

  // Exit with non-zero code if blocking issues found
  if (result.hasBlockingIssues) {
    process.exit(1);
  }
}
