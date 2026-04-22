/**
 * Cursor doesn't have a native skill concept — it reads `.cursor/rules/*.mdc`
 * files. We translate each VGuard skill into one MDC file per skill so the
 * Cursor agent picks them up alongside the adapter-generated rule mdc files.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceSkill } from '../skills-helpers.js';
import type { SkillWriteResult } from '../claude-code/skills.js';

function toMdc(skill: SourceSkill, vguardVersion: string): string {
  const description = skill.frontmatter.description ?? '';
  const header =
    `---\n` +
    `description: ${description.replace(/\r?\n/g, ' ')}\n` +
    `globs:\n` +
    `alwaysApply: false\n` +
    `vguardSkill: ${skill.id}\n` +
    `vguardVersion: ${vguardVersion}\n` +
    `---\n\n`;
  return header + skill.body.trim() + '\n';
}

export function installCursorSkills(
  skills: SourceSkill[],
  repoRoot: string,
  vguardVersion: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const baseDir = join(repoRoot, '.cursor', 'rules');
  mkdirSync(baseDir, { recursive: true });
  for (const skill of skills) {
    const target = join(baseDir, `vguard-skill-${skill.id}.mdc`);
    try {
      writeFileSync(target, toMdc(skill, vguardVersion), 'utf8');
      result.installed.push(skill.id);
    } catch {
      result.skipped.push(skill.id);
    }
  }
  return result;
}

export function removeCursorSkills(
  skillIds: readonly string[],
  repoRoot: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const baseDir = join(repoRoot, '.cursor', 'rules');
  for (const id of skillIds) {
    const target = join(baseDir, `vguard-skill-${id}.mdc`);
    if (!existsSync(target)) {
      result.skipped.push(id);
      continue;
    }
    try {
      rmSync(target, { force: true });
      result.removed.push(id);
    } catch {
      result.skipped.push(id);
    }
  }
  return result;
}
