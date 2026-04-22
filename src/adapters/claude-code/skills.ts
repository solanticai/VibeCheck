/**
 * Claude Code writes skills natively as `.claude/skills/<id>/SKILL.md`.
 * No frontmatter transform needed — Claude Code understands the format.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceSkill } from '../skills-helpers.js';

const VGUARD_VERSION_KEY = 'vguardVersion';

export interface SkillWriteResult {
  installed: string[];
  skipped: string[];
  removed: string[];
}

function ensureVersionFrontmatter(raw: string, skillVersion: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return `---\nname: \nversion: ${skillVersion}\n${VGUARD_VERSION_KEY}: ${skillVersion}\n---\n\n${raw}`;
  }
  const fmRaw = match[1];
  const body = match[2];
  const hasKey = new RegExp(`^${VGUARD_VERSION_KEY}:`, 'm').test(fmRaw);
  const nextFm = hasKey
    ? fmRaw.replace(new RegExp(`^${VGUARD_VERSION_KEY}:.*$`, 'm'), `${VGUARD_VERSION_KEY}: ${skillVersion}`)
    : `${fmRaw}\n${VGUARD_VERSION_KEY}: ${skillVersion}`;
  return `---\n${nextFm}\n---\n${body}`;
}

export function installClaudeCodeSkills(
  skills: SourceSkill[],
  repoRoot: string,
  vguardVersion: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const baseDir = join(repoRoot, '.claude', 'skills');
  mkdirSync(baseDir, { recursive: true });

  for (const skill of skills) {
    const skillDir = join(baseDir, skill.id);
    const target = join(skillDir, 'SKILL.md');
    try {
      mkdirSync(skillDir, { recursive: true });
      const raw = readFileSync(skill.sourcePath, 'utf8');
      const withVersion = ensureVersionFrontmatter(raw, vguardVersion);
      writeFileSync(target, withVersion, 'utf8');
      result.installed.push(skill.id);
    } catch {
      result.skipped.push(skill.id);
    }
  }
  return result;
}

export function removeClaudeCodeSkills(
  skillIds: readonly string[],
  repoRoot: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const baseDir = join(repoRoot, '.claude', 'skills');
  for (const id of skillIds) {
    const dir = join(baseDir, id);
    if (!existsSync(dir)) {
      result.skipped.push(id);
      continue;
    }
    try {
      rmSync(dir, { recursive: true, force: true });
      result.removed.push(id);
    } catch {
      result.skipped.push(id);
    }
  }
  return result;
}
