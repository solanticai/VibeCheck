import inquirer from 'inquirer';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { VibeCheckConfig, AgentType } from '../../types.js';

// Import to register presets and rules
import '../../presets/index.js';
import '../../rules/index.js';

import { getAllPresets } from '../../config/presets.js';
import { resolveConfig } from '../../config/loader.js';
import { compileConfig } from '../../config/compile.js';
import { claudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { mergeSettings } from '../../adapters/claude-code/settings-merger.js';

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VibeCheck — AI Coding Guardrails\n');

  // Check if already initialized
  if (
    existsSync(join(projectRoot, 'vibecheck.config.ts')) ||
    existsSync(join(projectRoot, '.vibecheckrc.json'))
  ) {
    console.log('  VibeCheck is already configured in this project.');
    console.log('  Run `vibecheck generate` to regenerate hooks.\n');
    return;
  }

  // Detect framework
  const framework = detectFramework(projectRoot);
  if (framework) {
    console.log(`  Detected: ${framework}\n`);
  }

  // Interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'presets',
      message: 'Which presets do you want to enable?',
      choices: Array.from(getAllPresets().values()).map((p) => ({
        name: `${p.id} — ${p.description}`,
        value: p.id,
        checked: framework === 'nextjs' && p.id === 'nextjs-15',
      })),
    },
    {
      type: 'checkbox',
      name: 'agents',
      message: 'Which AI agents do you use?',
      choices: [
        { name: 'Claude Code (runtime enforcement)', value: 'claude-code', checked: true },
        { name: 'Cursor (advisory)', value: 'cursor' },
        { name: 'Codex (advisory)', value: 'codex' },
        { name: 'OpenCode (advisory)', value: 'opencode' },
      ],
    },
    {
      type: 'input',
      name: 'protectedBranches',
      message: 'Protected branches (comma-separated):',
      default: 'main, master',
    },
  ]);

  // Build config
  const protectedBranches = (answers.protectedBranches as string)
    .split(',')
    .map((b: string) => b.trim())
    .filter(Boolean);

  const config: VibeCheckConfig = {
    presets: answers.presets as string[],
    agents: answers.agents as AgentType[],
    rules: {
      'security/branch-protection': {
        protectedBranches,
      },
    },
  };

  // Write config file
  const configContent = `import { defineConfig } from '@solanticai/vibecheck';

export default defineConfig(${JSON.stringify(config, null, 2)});
`;

  await writeFile(join(projectRoot, 'vibecheck.config.ts'), configContent, 'utf-8');
  console.log('\n  Created vibecheck.config.ts');

  // Resolve config
  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(config, presetMap);

  // Compile config for fast hook loading
  await compileConfig(resolvedConfig, projectRoot);
  console.log('  Created .vibecheck/cache/resolved-config.json');

  // Generate adapter output
  if ((answers.agents as string[]).includes('claude-code')) {
    const files = await claudeCodeAdapter.generate(resolvedConfig, projectRoot);

    for (const file of files) {
      const fullPath = join(projectRoot, file.path);

      if (file.mergeStrategy === 'merge' && file.path.endsWith('settings.json')) {
        const generated = JSON.parse(file.content);
        await mergeSettings(projectRoot, generated);
        console.log(`  Merged ${file.path}`);
      } else {
        const dir = join(projectRoot, file.path, '..');
        await mkdir(dir, { recursive: true });
        await writeFile(fullPath, file.content, 'utf-8');
        console.log(`  Created ${file.path}`);
      }
    }
  }

  // Summary
  const ruleCount = resolvedConfig.rules.size;
  console.log(`\n  VibeCheck initialized with ${ruleCount} active rules.`);
  console.log('  Run `vibecheck doctor` to verify your setup.\n');
}

function detectFramework(projectRoot: string): string | null {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;

  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    if (deps.next) return 'nextjs';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.svelte || deps['@sveltejs/kit']) return 'svelte';
    if (deps.angular || deps['@angular/core']) return 'angular';
  } catch {
    // Ignore
  }

  return null;
}
