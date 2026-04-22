/**
 * OpenCode reads `.opencode/instructions.md`. Same managed-block strategy
 * as the codex adapter.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { SourceSkill } from '../skills-helpers.js';
import { renderManagedBlock, replaceManagedBlock } from '../skills-helpers.js';
import type { SkillWriteResult } from '../claude-code/skills.js';

const TARGET_FILE = '.opencode/instructions.md';

function writeTo(targetPath: string, content: string): void {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, 'utf8');
}

export function installOpenCodeSkills(
  skills: SourceSkill[],
  repoRoot: string,
  vguardVersion: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const target = join(repoRoot, TARGET_FILE);
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : `# OpenCode Instructions\n`;
  const block = renderManagedBlock(skills);
  const versioned = block
    ? block.replace(
        /<!-- vguard-skills:start -->/,
        `<!-- vguard-skills:start -->\n<!-- vguard v${vguardVersion} -->`,
      )
    : '';
  const next = replaceManagedBlock(existing, versioned);
  try {
    writeTo(target, next);
    result.installed.push(...skills.map((s) => s.id));
  } catch {
    result.skipped.push(...skills.map((s) => s.id));
  }
  return result;
}

export function removeOpenCodeSkills(
  skillIds: readonly string[],
  repoRoot: string,
): SkillWriteResult {
  const result: SkillWriteResult = { installed: [], skipped: [], removed: [] };
  const target = join(repoRoot, TARGET_FILE);
  if (!existsSync(target)) {
    result.skipped.push(...skillIds);
    return result;
  }
  try {
    const existing = readFileSync(target, 'utf8');
    writeTo(target, replaceManagedBlock(existing, ''));
    result.removed.push(...skillIds);
  } catch {
    result.skipped.push(...skillIds);
  }
  return result;
}
