import { checkbox, confirm, input, select } from '@inquirer/prompts';
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
import { applyProjectIntegrations } from '../../utils/project-scripts.js';
import { DEFAULT_VGUARDIGNORE } from './init-templates/vguardignore.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { isInteractive } from '../ui/env.js';

const KNOWN_AGENTS: AgentType[] = ['claude-code', 'cursor', 'codex', 'opencode'];
type FolderAgent = AgentType | 'github-actions';

export interface InitOptions {
  force?: boolean;
  yes?: boolean;
  preset?: string[];
  agent?: string[];
  protectedBranches?: string;
  cloud?: boolean;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const nonInteractive = options.yes === true || !isInteractive();

  printBanner('Init', 'AI coding guardrails setup');

  const hasExistingConfig =
    existsSync(join(projectRoot, 'vguard.config.ts')) ||
    existsSync(join(projectRoot, '.vguardrc.json'));

  if (hasExistingConfig && !options.force) {
    console.log('  VGuard is already configured in this project.');
    console.log('  Run `vguard generate` to regenerate hooks.');
    console.log('  Run `vguard init --force` to reconfigure from scratch.\n');
    return;
  }

  if (options.force && hasExistingConfig) {
    console.log(color.yellow('  WARNING') + ': --force will overwrite the existing VGuard config');
    console.log(
      '  Files that may be rewritten: vguard.config.ts, .vguard/cache/, .claude/*, .cursor/*',
    );
    if (!nonInteractive) {
      const confirmed = await confirm({
        message: 'Continue and overwrite existing configuration?',
        default: false,
      });
      if (!confirmed) {
        console.log('\n  Aborted.\n');
        return;
      }
    } else if (!options.yes) {
      console.error(
        color.red(
          '  Refusing to overwrite existing config in non-interactive mode. Pass --yes to confirm.\n',
        ),
      );
      process.exit(1);
    }
    console.log('  Reconfiguring VGuard (--force)\n');
  }

  // Detect framework
  const framework = detectFramework(projectRoot);
  if (framework) {
    console.log(`  Detected: ${framework}\n`);
  }

  const presetIds = await resolvePresets(options, framework, nonInteractive);
  const agents = await resolveAgents(options, nonInteractive);
  const selectedFolders = await resolveFolders(agents, nonInteractive);
  const protectedBranches = await resolveProtectedBranches(options, nonInteractive);
  const enableCloud = await resolveCloud(options, nonInteractive);

  if (enableCloud && !nonInteractive) {
    await handleCloudAuth();
  }

  const config: VGuardConfig = {
    presets: presetIds,
    agents,
    rules: {
      'security/branch-protection': {
        protectedBranches,
      },
    },
    ...(enableCloud
      ? {
          cloud: {
            enabled: true,
            autoSync: true,
          },
        }
      : {}),
  };

  const configContent = `import { defineConfig } from '@anthril/vguard';

export default defineConfig(${JSON.stringify(config, null, 2)});
`;

  await writeFile(join(projectRoot, 'vguard.config.ts'), configContent, 'utf-8');
  console.log('\n  Created vguard.config.ts');

  const presetMap = getAllPresets();
  const resolvedConfig = resolveConfig(config, presetMap);

  await compileConfig(resolvedConfig, projectRoot);
  console.log('  Created .vguard/cache/resolved-config.json');

  const writeGeneratedFile = async (file: GeneratedFile) => {
    const fullPath = join(projectRoot, file.path);
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

  if (agents.includes('claude-code') && selectedFolders.has('claude-code')) {
    const files = await claudeCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }
  if (agents.includes('cursor') && selectedFolders.has('cursor')) {
    const files = await cursorAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }
  if (agents.includes('codex') && selectedFolders.has('codex')) {
    const files = await codexAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }
  if (agents.includes('opencode') && selectedFolders.has('opencode')) {
    const files = await openCodeAdapter.generate(resolvedConfig, projectRoot);
    for (const file of files) await writeGeneratedFile(file);
  }
  if (selectedFolders.has('github-actions')) {
    const gaFiles = await githubActionsAdapter.generate(resolvedConfig, projectRoot);
    for (const file of gaFiles) await writeGeneratedFile(file);
  }

  const ignorePath = join(projectRoot, '.vguardignore');
  if (!existsSync(ignorePath)) {
    await writeFile(ignorePath, DEFAULT_VGUARDIGNORE, 'utf-8');
    console.log('  Created .vguardignore');
  } else {
    console.log('  Skipped .vguardignore (already exists)');
  }

  await applyProjectIntegrations(projectRoot, { interactive: !nonInteractive });

  await maybeInstallCompanionSkills(projectRoot, agents, nonInteractive);

  const ruleCount = resolvedConfig.rules.size;
  console.log(`\n  ${color.green('VGuard initialized')} with ${ruleCount} active rules.`);
  console.log('  Run `vguard doctor` to verify your setup.\n');
}

/**
 * Offer to install VGuard companion skills into the selected agent
 * directories. Skipped entirely in non-interactive / CI runs so the init
 * flow stays scriptable; users can always run `vguard skills install`
 * later.
 */
async function maybeInstallCompanionSkills(
  projectRoot: string,
  agents: AgentType[],
  nonInteractive: boolean,
): Promise<void> {
  try {
    const { listSourceSkills } = await import('../../adapters/skills-helpers.js');
    const skills = listSourceSkills();
    if (skills.length === 0) return;

    if (nonInteractive) {
      console.log(
        `  Skipped companion skills (non-interactive). Run ${color.cyan(
          'vguard skills install',
        )} when you're ready.`,
      );
      return;
    }

    const wantsAny = await confirm({
      message: `Install VGuard companion skills (${skills.length} available)?`,
      default: true,
    });
    if (!wantsAny) return;

    const { promptSkillSelection } = await import('../prompts/skills.js');
    const selected = await promptSkillSelection({ skills });
    if (selected.length === 0) return;

    const { filterSkills } = await import('../../adapters/skills-helpers.js');
    const chosen = filterSkills(skills, selected);
    const { BUILD_INFO } = await import('../build-info.js');

    const { installClaudeCodeSkills } = await import(
      '../../adapters/claude-code/skills.js'
    );
    const { installCursorSkills } = await import('../../adapters/cursor/skills.js');
    const { installCodexSkills } = await import('../../adapters/codex/skills.js');
    const { installOpenCodeSkills } = await import('../../adapters/opencode/skills.js');

    for (const agent of agents) {
      if (agent === 'claude-code') {
        installClaudeCodeSkills(chosen, projectRoot, BUILD_INFO.version);
      } else if (agent === 'cursor') {
        installCursorSkills(chosen, projectRoot, BUILD_INFO.version);
      } else if (agent === 'codex') {
        installCodexSkills(chosen, projectRoot, BUILD_INFO.version);
      } else if (agent === 'opencode') {
        installOpenCodeSkills(chosen, projectRoot, BUILD_INFO.version);
      }
      console.log(`  Installed ${chosen.length} skill(s) for ${color.cyan(agent)}`);
    }
  } catch {
    // Skill install failures must never block init.
  }
}

async function resolvePresets(
  options: InitOptions,
  framework: string | null,
  nonInteractive: boolean,
): Promise<string[]> {
  const availablePresets = Array.from(getAllPresets().values());
  const availableIds = new Set(availablePresets.map((p) => p.id));

  if (options.preset?.length) {
    const unknown = options.preset.filter((id) => !availableIds.has(id));
    if (unknown.length) {
      throw new Error(`Unknown preset(s): ${unknown.join(', ')}`);
    }
    return options.preset;
  }

  if (nonInteractive) {
    if (framework === 'nextjs' && availableIds.has('nextjs-15')) return ['nextjs-15'];
    return [];
  }

  return (await checkbox({
    message: 'Which presets do you want to enable?',
    choices: availablePresets.map((p) => ({
      name: `${p.id} ${color.dim('—')} ${p.description}`,
      value: p.id,
      checked: framework === 'nextjs' && p.id === 'nextjs-15',
    })),
  })) as string[];
}

async function resolveAgents(options: InitOptions, nonInteractive: boolean): Promise<AgentType[]> {
  if (options.agent?.length) {
    const unknown = options.agent.filter((id) => !KNOWN_AGENTS.includes(id as AgentType));
    if (unknown.length) {
      throw new Error(
        `Unknown agent(s): ${unknown.join(', ')}. Valid: ${KNOWN_AGENTS.join(', ')}.`,
      );
    }
    return options.agent as AgentType[];
  }

  if (nonInteractive) return ['claude-code'];

  return (await checkbox({
    message: 'Which AI agents do you use?',
    choices: [
      { name: 'Claude Code (runtime enforcement)', value: 'claude-code', checked: true },
      { name: 'Cursor (advisory)', value: 'cursor' },
      { name: 'Codex (advisory)', value: 'codex' },
      { name: 'OpenCode (advisory)', value: 'opencode' },
    ],
  })) as AgentType[];
}

async function resolveFolders(
  selectedAgents: AgentType[],
  nonInteractive: boolean,
): Promise<Set<FolderAgent>> {
  if (nonInteractive) {
    return new Set<FolderAgent>([...selectedAgents, 'github-actions']);
  }

  const folderChoices = buildFolderChoices(selectedAgents);
  const selected = (await checkbox({
    message: 'Update AI agent configuration folders? (Recommended)',
    choices: folderChoices,
  })) as FolderAgent[];
  return new Set(selected);
}

async function resolveProtectedBranches(
  options: InitOptions,
  nonInteractive: boolean,
): Promise<string[]> {
  if (options.protectedBranches) {
    return options.protectedBranches
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
  }

  if (nonInteractive) return ['main', 'master'];

  const answer = await input({
    message: 'Protected branches (comma-separated):',
    default: 'main, master',
  });
  return answer
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
}

async function resolveCloud(options: InitOptions, nonInteractive: boolean): Promise<boolean> {
  if (typeof options.cloud === 'boolean') return options.cloud;
  if (nonInteractive) return false;
  return await confirm({
    message: 'Enable VGuard Cloud? (real-time telemetry dashboard)',
    default: false,
  });
}

async function handleCloudAuth(): Promise<void> {
  const method = await select({
    message: 'How would you like to connect?',
    choices: [
      { name: 'Login via browser (recommended)', value: 'browser' },
      { name: 'I have an API key', value: 'key' },
      { name: 'Skip for now (configure later with `vguard cloud connect`)', value: 'skip' },
    ],
  });

  if (method === 'browser') {
    try {
      const { cloudLoginCommand } = await import('./cloud-login.js');
      await cloudLoginCommand({});
      const { cloudConnectCommand } = await import('./cloud-connect.js');
      await cloudConnectCommand({});
    } catch {
      console.log('  Cloud setup skipped — you can run `vguard cloud connect` later.\n');
    }
  } else if (method === 'key') {
    const key = await input({ message: 'API Key (vc_...):' });
    const projectId = await input({ message: 'Project ID:' });
    try {
      const { cloudConnectCommand } = await import('./cloud-connect.js');
      await cloudConnectCommand({ key, projectId });
    } catch {
      console.log('  Cloud setup skipped — you can run `vguard cloud connect` later.\n');
    }
  }
}

function buildFolderChoices(selectedAgents: AgentType[]) {
  const agentFolderMap: Record<string, { name: string; description: string }> = {
    'claude-code': {
      name: '.claude/',
      description: 'hooks, commands, and rules for Claude Code',
    },
    cursor: { name: '.cursor/', description: 'rules for Cursor' },
    codex: { name: '.codex/ + AGENTS.md', description: 'instructions for Codex' },
    opencode: { name: '.opencode/', description: 'instructions for OpenCode' },
  };

  const choices = Object.entries(agentFolderMap).map(([agentId, info]) => ({
    name: `${info.name} — ${info.description}`,
    value: agentId,
    checked: selectedAgents.includes(agentId as AgentType),
  }));

  choices.push({
    name: '.github/workflows/ — CI workflow for VGuard',
    value: 'github-actions',
    checked: true,
  });

  return choices;
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
