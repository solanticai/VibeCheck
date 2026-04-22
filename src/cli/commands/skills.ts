/**
 * `vguard skills` — companion skill installer.
 *
 * Subcommands:
 *   skills list               — print every bundled skill
 *   skills install            — interactive checkbox prompt
 *   skills add <id...>        — non-interactive install
 *   skills remove <id...>     — non-interactive uninstall
 *
 * The source skills live under `ai-for-vibe-guard/skills/` in the
 * published package; per-agent writers under `src/adapters/<agent>/skills.ts`
 * translate them into the destination each agent understands.
 */

import { BUILD_INFO } from '../build-info.js';
import { color } from '../ui/colors.js';
import { glyph } from '../ui/glyphs.js';
import { info, warn } from '../ui/log.js';
import { EXIT } from '../exit-codes.js';

import {
  filterSkills,
  listSourceSkills,
  type SourceSkill,
} from '../../adapters/skills-helpers.js';
import type { AgentType } from '../../types.js';

import { discoverConfigFile, readRawConfig } from '../../config/discovery.js';
import { resolveConfig } from '../../config/loader.js';
import { getAllPresets } from '../../config/presets.js';

import {
  installClaudeCodeSkills,
  removeClaudeCodeSkills,
  type SkillWriteResult,
} from '../../adapters/claude-code/skills.js';
import { installCursorSkills, removeCursorSkills } from '../../adapters/cursor/skills.js';
import { installCodexSkills, removeCodexSkills } from '../../adapters/codex/skills.js';
import { installOpenCodeSkills, removeOpenCodeSkills } from '../../adapters/opencode/skills.js';

export type SkillTargetAgent = Extract<AgentType, 'claude-code' | 'cursor' | 'codex' | 'opencode'>;

const SUPPORTED_AGENTS: SkillTargetAgent[] = ['claude-code', 'cursor', 'codex', 'opencode'];

export interface SkillsBaseOptions {
  agent?: SkillTargetAgent | 'all';
}

async function resolveTargetAgents(options: SkillsBaseOptions): Promise<SkillTargetAgent[]> {
  if (options.agent && options.agent !== 'all') return [options.agent];

  const projectRoot = process.cwd();
  const discovered = discoverConfigFile(projectRoot);
  if (!discovered) return SUPPORTED_AGENTS;

  try {
    const raw = await readRawConfig(discovered);
    // readRawConfig returns an arbitrary object — we only care about the
    // `agents` field for target selection.
    const resolved = resolveConfig(raw as never, getAllPresets());
    const configured = resolved.agents ?? [];
    const intersect = configured.filter((a): a is SkillTargetAgent =>
      SUPPORTED_AGENTS.includes(a as SkillTargetAgent),
    );
    return intersect.length > 0 ? intersect : SUPPORTED_AGENTS;
  } catch {
    return SUPPORTED_AGENTS;
  }
}

function writeForAgent(
  agent: SkillTargetAgent,
  skills: SourceSkill[],
  repoRoot: string,
  vguardVersion: string,
): SkillWriteResult {
  switch (agent) {
    case 'claude-code':
      return installClaudeCodeSkills(skills, repoRoot, vguardVersion);
    case 'cursor':
      return installCursorSkills(skills, repoRoot, vguardVersion);
    case 'codex':
      return installCodexSkills(skills, repoRoot, vguardVersion);
    case 'opencode':
      return installOpenCodeSkills(skills, repoRoot, vguardVersion);
  }
}

function removeForAgent(
  agent: SkillTargetAgent,
  ids: readonly string[],
  repoRoot: string,
): SkillWriteResult {
  switch (agent) {
    case 'claude-code':
      return removeClaudeCodeSkills(ids, repoRoot);
    case 'cursor':
      return removeCursorSkills(ids, repoRoot);
    case 'codex':
      return removeCodexSkills(ids, repoRoot);
    case 'opencode':
      return removeOpenCodeSkills(ids, repoRoot);
  }
}

// ─── skills list ────────────────────────────────────────────────────────────

export function skillsListCommand(options: { json?: boolean } = {}): void {
  const skills = listSourceSkills();
  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        skills.map((s) => ({
          id: s.id,
          name: s.frontmatter.name,
          description: s.frontmatter.description,
        })),
        null,
        2,
      ) + '\n',
    );
    process.exit(EXIT.OK);
  }

  if (skills.length === 0) {
    warn(
      'No bundled skills found. If you installed @anthril/vguard from npm, ensure ai-for-vibe-guard/skills is included in the tarball.',
    );
    process.exit(EXIT.OK);
  }

  info(color.bold(`VGuard companion skills (${skills.length}):`));
  for (const skill of skills) {
    const desc = skill.frontmatter.description ?? '';
    info(`  ${glyph('bullet')} ${color.cyan(skill.id)} — ${desc}`);
  }
  info('');
  info(`Install with ${color.cyan('vguard skills install')} or ${color.cyan('vguard skills add <id...>')}`);
  process.exit(EXIT.OK);
}

// ─── shared apply/remove ────────────────────────────────────────────────────

async function applyInstall(
  selectedIds: readonly string[],
  options: SkillsBaseOptions,
): Promise<void> {
  const allSkills = listSourceSkills();
  const chosen = filterSkills(allSkills, selectedIds);
  if (chosen.length === 0) {
    info('No skills selected. Nothing to do.');
    process.exit(EXIT.OK);
  }

  const agents = await resolveTargetAgents(options);
  const repoRoot = process.cwd();

  for (const agent of agents) {
    const result = writeForAgent(agent, chosen, repoRoot, BUILD_INFO.version);
    info(
      `${glyph('pass')} ${color.cyan(agent)}: installed ${result.installed.length} skill${result.installed.length === 1 ? '' : 's'}${
        result.skipped.length ? ` (skipped ${result.skipped.length})` : ''
      }`,
    );
  }
  process.exit(EXIT.OK);
}

// ─── skills install (interactive) ───────────────────────────────────────────

export interface SkillsInstallOptions extends SkillsBaseOptions {
  yes?: boolean;
  skills?: string; // comma-separated or 'all' / 'none'
}

export async function skillsInstallCommand(options: SkillsInstallOptions = {}): Promise<void> {
  const allSkills = listSourceSkills();
  if (allSkills.length === 0) {
    warn('No bundled skills found.');
    process.exit(EXIT.OK);
  }

  // Non-interactive path: --skills=all|none|id1,id2
  if (options.skills !== undefined || options.yes === true || process.env.CI === 'true') {
    if (options.skills === 'none') {
      info('Skill install skipped (--skills=none).');
      process.exit(EXIT.OK);
    }
    const ids =
      !options.skills || options.skills === 'all'
        ? allSkills.map((s) => s.id)
        : options.skills.split(',').map((s) => s.trim()).filter(Boolean);
    await applyInstall(ids, options);
    return;
  }

  const { promptSkillSelection } = await import('../prompts/skills.js');
  const selected = await promptSkillSelection({ skills: allSkills });
  await applyInstall(selected, options);
}

// ─── skills add <id...> ─────────────────────────────────────────────────────

export async function skillsAddCommand(
  ids: readonly string[],
  options: SkillsBaseOptions = {},
): Promise<void> {
  if (ids.length === 0) {
    warn('Usage: vguard skills add <id> [<id>...]');
    process.exit(EXIT.USAGE);
  }
  await applyInstall(ids, options);
}

// ─── skills remove <id...> ──────────────────────────────────────────────────

export async function skillsRemoveCommand(
  ids: readonly string[],
  options: SkillsBaseOptions = {},
): Promise<void> {
  if (ids.length === 0) {
    warn('Usage: vguard skills remove <id> [<id>...]');
    process.exit(EXIT.USAGE);
  }
  const agents = await resolveTargetAgents(options);
  const repoRoot = process.cwd();
  for (const agent of agents) {
    const result = removeForAgent(agent, ids, repoRoot);
    info(
      `${glyph('pass')} ${color.cyan(agent)}: removed ${result.removed.length}${
        result.skipped.length ? ` (not present: ${result.skipped.length})` : ''
      }`,
    );
  }
  process.exit(EXIT.OK);
}
