import inquirer from 'inquirer';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { VGuardConfig, AgentType, GeneratedFile } from '../../types.js';

// Import to register presets and rules
import '../../presets/index.js';
import '../../rules/index.js';

import { getAllPresets } from '../../config/presets.js';
import { resolveConfig } from '../../config/loader.js';
import { compileConfig } from '../../config/compile.js';
import { claudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { cursorAdapter } from '../../adapters/cursor/adapter.js';
import { codexAdapter } from '../../adapters/codex/adapter.js';
import { openCodeAdapter } from '../../adapters/opencode/adapter.js';
import { githubActionsAdapter } from '../../adapters/github-actions/adapter.js';
import { mergeSettings } from '../../adapters/claude-code/settings-merger.js';
import { DEFAULT_VGUARDIGNORE } from './init-templates/vguardignore.js';

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VGuard — AI Coding Guardrails\n');

  // Check if already initialized
  if (
    existsSync(join(projectRoot, 'vguard.config.ts')) ||
    existsSync(join(projectRoot, '.vguardrc.json'))
  ) {
    console.log('  VGuard is already configured in this project.');
    console.log('  Run `vguard generate` to regenerate hooks.\n');
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

  const selectedAgents = answers.agents as AgentType[];

  // Ask about updating AI agent configuration folders
  const folderChoices = buildFolderChoices(selectedAgents);

  const folderAnswers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'folders',
      message: 'Update AI agent configuration folders? (Recommended)',
      choices: folderChoices,
    },
  ]);

  const selectedFolders = new Set(folderAnswers.folders as string[]);

  // Cloud setup prompt
  const cloudAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableCloud',
      message: 'Enable VGuard Cloud? (real-time telemetry dashboard)',
      default: false,
    },
  ]);

  if (cloudAnswers.enableCloud) {
    const cloudMethod = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'How would you like to connect?',
        choices: [
          { name: 'Login via browser (recommended)', value: 'browser' },
          { name: 'I have an API key', value: 'key' },
          { name: 'Skip for now (configure later with `vguard cloud connect`)', value: 'skip' },
        ],
      },
    ]);

    if (cloudMethod.authMethod === 'browser') {
      try {
        const { cloudLoginCommand } = await import('./cloud-login.js');
        await cloudLoginCommand({});
        const { cloudConnectCommand } = await import('./cloud-connect.js');
        await cloudConnectCommand({});
      } catch {
        console.log('  Cloud setup skipped — you can run `vguard cloud connect` later.\n');
      }
    } else if (cloudMethod.authMethod === 'key') {
      const keyAnswers = await inquirer.prompt([
        { type: 'input', name: 'key', message: 'API Key (vc_...):' },
        { type: 'input', name: 'projectId', message: 'Project ID:' },
      ]);
      try {
        const { cloudConnectCommand } = await import('./cloud-connect.js');
        await cloudConnectCommand({ key: keyAnswers.key, projectId: keyAnswers.projectId });
      } catch {
        console.log('  Cloud setup skipped — you can run `vguard cloud connect` later.\n');
      }
    }
  }

  // Build config
  const protectedBranches = (answers.protectedBranches as string)
    .split(',')
    .map((b: string) => b.trim())
    .filter(Boolean);

  const config: VGuardConfig = {
    presets: answers.presets as string[],
    agents: selectedAgents,
    rules: {
      'security/branch-protection': {
        protectedBranches,
      },
    },
    ...(cloudAnswers.enableCloud
      ? {
          cloud: {
            enabled: true,
            autoSync: true,
          },
        }
      : {}),
  };

  // Write config file
  const configContent = `import { defineConfig } from '@solanticai/vguard';

export default defineConfig(${JSON.stringify(config, null, 2)});
`;

  await writeFile(join(projectRoot, 'vguard.config.ts'), configContent, 'utf-8');
  console.log('\n  Created vguard.config.ts');

  // Resolve config
  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(config, presetMap);

  // Compile config for fast hook loading
  await compileConfig(resolvedConfig, projectRoot);
  console.log('  Created .vguard/cache/resolved-config.json');

  // File writer with merge strategy handling
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
      await writeFile(fullPath, file.content, 'utf-8');
      console.log(`  Created ${file.path}`);
    }
  };

  // Generate adapter output for selected agents and folders
  if (selectedAgents.includes('claude-code') && selectedFolders.has('claude-code')) {
    const files = await claudeCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (selectedAgents.includes('cursor') && selectedFolders.has('cursor')) {
    const files = await cursorAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (selectedAgents.includes('codex') && selectedFolders.has('codex')) {
    const files = await codexAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  if (selectedAgents.includes('opencode') && selectedFolders.has('opencode')) {
    const files = await openCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }

  // GitHub Actions is always generated
  if (selectedFolders.has('github-actions')) {
    const gaFiles = await githubActionsAdapter.generate(resolvedConfig, projectRoot);
    for (const file of gaFiles) await writeGeneratedFile(file);
  }

  // Write starter .vguardignore (create-only — don't overwrite existing).
  const ignorePath = join(projectRoot, '.vguardignore');
  if (!existsSync(ignorePath)) {
    await writeFile(ignorePath, DEFAULT_VGUARDIGNORE, 'utf-8');
    console.log('  Created .vguardignore');
  } else {
    console.log('  Skipped .vguardignore (already exists)');
  }

  // Offer to add convenience npm scripts
  await injectNpmScripts(projectRoot);

  // Summary
  const ruleCount = resolvedConfig.rules.size;
  console.log(`\n  VGuard initialized with ${ruleCount} active rules.`);
  console.log('  Run `vguard doctor` to verify your setup.\n');
}

/**
 * Build folder choices for the "update AI agent folders" prompt.
 * Selected agents are auto-checked.
 */
function buildFolderChoices(selectedAgents: AgentType[]) {
  const agentFolderMap: Record<string, { name: string; description: string }> = {
    'claude-code': {
      name: '.claude/',
      description: 'hooks, commands, and rules for Claude Code',
    },
    cursor: {
      name: '.cursor/',
      description: 'rules for Cursor',
    },
    codex: {
      name: '.codex/ + AGENTS.md',
      description: 'instructions and guidelines for Codex',
    },
    opencode: {
      name: '.opencode/',
      description: 'instructions for OpenCode',
    },
  };

  const choices = Object.entries(agentFolderMap).map(([agentId, info]) => ({
    name: `${info.name} — ${info.description}`,
    value: agentId,
    checked: selectedAgents.includes(agentId as AgentType),
  }));

  // Always offer GitHub Actions
  choices.push({
    name: '.github/workflows/ — CI workflow for VGuard',
    value: 'github-actions',
    checked: true,
  });

  return choices;
}

/**
 * Offer to inject VGuard convenience scripts into the project's package.json.
 * This allows running `npm run vguard:lint` instead of `npx vguard lint`.
 */
async function injectNpmScripts(projectRoot: string): Promise<void> {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return;

  const scriptAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addScripts',
      message: 'Add VGuard convenience scripts to package.json?',
      default: true,
    },
  ]);

  if (!scriptAnswer.addScripts) return;

  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const existing = pkg.scripts ?? {};

    const newScripts: Record<string, string> = {
      vguard: 'vguard',
      'vguard:lint': 'vguard lint',
      'vguard:fix': 'vguard fix',
      'vguard:doctor': 'vguard doctor',
      'vguard:sync': 'vguard sync',
      'vguard:report': 'vguard report',
    };

    let added = 0;
    for (const [key, value] of Object.entries(newScripts)) {
      if (!(key in existing)) {
        existing[key] = value;
        added++;
      }
    }

    if (added > 0) {
      pkg.scripts = existing;
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(`  Added ${added} VGuard scripts to package.json`);
    } else {
      console.log('  VGuard scripts already present in package.json');
    }
  } catch {
    // Non-critical — skip silently
  }
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
