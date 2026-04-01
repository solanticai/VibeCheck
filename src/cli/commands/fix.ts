import { writeFileSync, readFileSync } from 'node:fs';

import '../../presets/index.js';
import '../../rules/index.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';
import { scanProject } from '../../engine/scanner.js';
import type { VibeCheckConfig, HookContext } from '../../types.js';
import { getAllRules } from '../../engine/registry.js';

/**
 * `vibecheck fix`
 *
 * Scans the project and applies autofixes for rules that provide them.
 */
export async function fixCommand(options: { dryRun?: boolean } = {}): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VibeCheck Fix — Auto-fixing issues...\n');

  // Load config
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    console.error('  No vibecheck config found. Run `vibecheck init` first.');
    process.exit(1);
  }

  const rawConfig = await readRawConfig(discovered);
  const presetMap = getAllPresets();
  const config = resolveConfig(rawConfig as VibeCheckConfig, presetMap);

  // Scan for issues
  const scanResult = await scanProject({ rootDir: projectRoot, config });

  if (scanResult.issues.length === 0) {
    console.log('  No issues found.\n');
    return;
  }

  // Collect autofixes by running rules again with full context
  const allRules = getAllRules();
  let fixesApplied = 0;
  let fixesAvailable = 0;

  // Group issues by file for batch processing
  const issuesByFile = new Map<string, typeof scanResult.issues>();
  for (const issue of scanResult.issues) {
    const existing = issuesByFile.get(issue.filePath) ?? [];
    existing.push(issue);
    issuesByFile.set(issue.filePath, existing);
  }

  for (const [filePath, issues] of issuesByFile) {
    for (const issue of issues) {
      const rule = allRules.get(issue.ruleId);
      if (!rule) continue;

      // Re-run the rule to get the autofix
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const context: HookContext = {
        event: 'PreToolUse',
        tool: 'Write',
        toolInput: { file_path: filePath, content },
        projectConfig: config,
        gitContext: {
          branch: null,
          isDirty: false,
          repoRoot: projectRoot,
          unpushedCount: 0,
          hasRemote: false,
        },
      };

      const result = await rule.check(context);
      if (result.autofix) {
        fixesAvailable++;

        if (!options.dryRun) {
          try {
            writeFileSync(filePath, result.autofix.newContent, 'utf-8');
            fixesApplied++;
            console.log(`  Fixed: ${issue.ruleId} in ${filePath}`);
            console.log(`         ${result.autofix.description}`);
          } catch (err) {
            console.error(`  Failed to apply fix to ${filePath}: ${err}`);
          }
        } else {
          console.log(`  Would fix: ${issue.ruleId} in ${filePath}`);
          console.log(`             ${result.autofix.description}`);
        }
      }
    }
  }

  console.log('');
  if (options.dryRun) {
    console.log(`  ${fixesAvailable} autofix${fixesAvailable !== 1 ? 'es' : ''} available.`);
    console.log('  Run `vibecheck fix` without --dry-run to apply.\n');
  } else if (fixesApplied > 0) {
    console.log(`  Applied ${fixesApplied} autofix${fixesApplied !== 1 ? 'es' : ''}.\n`);
  } else {
    console.log(`  ${scanResult.issues.length} issue${scanResult.issues.length !== 1 ? 's' : ''} found but no autofixes available.\n`);
  }
}
