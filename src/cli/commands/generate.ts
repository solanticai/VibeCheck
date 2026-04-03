import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import '../../presets/index.js';
import '../../rules/index.js';

import { compileConfig } from '../../config/compile.js';
import { getAllPresets } from '../../config/presets.js';
import { resolveConfig } from '../../config/loader.js';
import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { claudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { cursorAdapter } from '../../adapters/cursor/adapter.js';
import { codexAdapter } from '../../adapters/codex/adapter.js';
import { openCodeAdapter } from '../../adapters/opencode/adapter.js';
import { githubActionsAdapter } from '../../adapters/github-actions/adapter.js';
import { mergeSettings } from '../../adapters/claude-code/settings-merger.js';
import type { VGuardConfig, GeneratedFile } from '../../types.js';

export async function generateCommand(): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VGuard — Regenerating hooks...\n');

  // Load config
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) {
    console.error('  No VGuard config found. Run `vguard init` first.');
    process.exit(1);
  }

  const rawConfig = await readRawConfig(discovered);
  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(rawConfig as VGuardConfig, presetMap);

  // Compile config cache
  await compileConfig(resolvedConfig, projectRoot);
  console.log('  Updated .vguard/cache/resolved-config.json');

  // Generate for each agent
  const writeGeneratedFile = async (file: GeneratedFile) => {
    const fullPath = join(projectRoot, file.path);

    // Handle create-only: skip if file already exists
    if (file.mergeStrategy === 'create-only') {
      if (existsSync(fullPath)) {
        console.log(`  Skipped ${file.path} (already exists)`);
        return;
      }
    }

    if (file.mergeStrategy === 'merge' && file.path.endsWith('settings.json')) {
      const generated = JSON.parse(file.content);
      await mergeSettings(projectRoot, generated);
      console.log(`  Merged ${file.path}`);
    } else {
      await mkdir(dirname(fullPath), { recursive: true });
      await fsWriteFile(fullPath, file.content, 'utf-8');
      console.log(`  Created ${file.path}`);
    }
  };

  if (resolvedConfig.agents.includes('claude-code')) {
    const files = await claudeCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (resolvedConfig.agents.includes('cursor')) {
    const files = await cursorAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (resolvedConfig.agents.includes('codex')) {
    const files = await codexAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (resolvedConfig.agents.includes('opencode')) {
    const files = await openCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  // GitHub Actions is always generated if any agent is configured
  const gaFiles = await githubActionsAdapter.generate(resolvedConfig, projectRoot);
  for (const file of gaFiles) await writeGeneratedFile(file);

  const ruleCount = Array.from(resolvedConfig.rules.values()).filter((r) => r.enabled).length;
  console.log(`\n  Generated output for ${ruleCount} active rules.\n`);
}
