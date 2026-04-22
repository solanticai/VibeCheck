/**
 * Shared checkbox prompt for selecting companion skills. Reused by
 * `vguard skills install` (dedicated command) and `vguard init`
 * (during first-time setup).
 */

import { checkbox } from '@inquirer/prompts';

import type { SourceSkill } from '../../adapters/skills-helpers.js';

export interface SkillSelectOptions {
  skills: SourceSkill[];
  /** Which skills should be pre-checked. Defaults to every skill. */
  preselect?: readonly string[];
  /** Override the prompt message. */
  message?: string;
}

export async function promptSkillSelection(options: SkillSelectOptions): Promise<string[]> {
  const { skills, preselect, message } = options;
  if (skills.length === 0) return [];

  const selected = await checkbox({
    message:
      message ?? 'Which VGuard companion skills should be installed in the agent skill directory?',
    choices: skills.map((skill) => ({
      name: `${skill.id} — ${skill.frontmatter.description ?? ''}`,
      value: skill.id,
      checked: preselect ? preselect.includes(skill.id) : true,
    })),
    loop: false,
  });

  return Array.isArray(selected) ? [...selected] : [];
}
