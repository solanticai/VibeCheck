import { describe, it, expect } from 'vitest';

import {
  MANAGED_BLOCK_START,
  MANAGED_BLOCK_END,
  renderManagedBlock,
  replaceManagedBlock,
  listSourceSkills,
  filterSkills,
} from '../../src/adapters/skills-helpers.js';

describe('skills-helpers', () => {
  it('listSourceSkills finds the bundled skills in the monorepo layout', () => {
    const skills = listSourceSkills();
    // The ai-for-vibe-guard folder ships 8 skills at the time of writing.
    expect(skills.length).toBeGreaterThanOrEqual(1);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain('setup-vguard');
    for (const skill of skills) {
      expect(skill.frontmatter.name).toBeTruthy();
      expect(skill.frontmatter.description).toBeTruthy();
    }
  });

  it('filterSkills narrows to requested ids', () => {
    const skills = listSourceSkills();
    const subset = filterSkills(skills, ['setup-vguard']);
    expect(subset.length).toBe(1);
    expect(subset[0].id).toBe('setup-vguard');
  });

  it('filterSkills returns all skills when ids is "all"', () => {
    const skills = listSourceSkills();
    expect(filterSkills(skills, 'all')).toEqual(skills);
  });

  describe('renderManagedBlock', () => {
    it('produces an empty string when no skills', () => {
      expect(renderManagedBlock([])).toBe('');
    });

    it('wraps skills between start and end markers', () => {
      const skills = listSourceSkills().slice(0, 1);
      const rendered = renderManagedBlock(skills);
      expect(rendered).toContain(MANAGED_BLOCK_START);
      expect(rendered).toContain(MANAGED_BLOCK_END);
      expect(rendered).toContain(`VGuard Skill: ${skills[0].frontmatter.name}`);
    });
  });

  describe('replaceManagedBlock', () => {
    it('appends a block when none exists', () => {
      const next = replaceManagedBlock('# Agents\n\nHello world.\n', 'NEW-BLOCK');
      expect(next).toContain('# Agents');
      expect(next).toContain('Hello world.');
      expect(next).toContain('NEW-BLOCK');
    });

    it('replaces an existing block in place, preserving surrounding content', () => {
      const doc = [
        '# Agents',
        '',
        'Before block.',
        '',
        MANAGED_BLOCK_START,
        '',
        'OLD CONTENT',
        '',
        MANAGED_BLOCK_END,
        '',
        'After block.',
      ].join('\n');
      const next = replaceManagedBlock(doc, 'NEW BLOCK BODY');
      expect(next).toContain('Before block.');
      expect(next).toContain('NEW BLOCK BODY');
      expect(next).toContain('After block.');
      expect(next).not.toContain('OLD CONTENT');
    });

    it('removes an existing block when newContent is empty', () => {
      const doc = [
        '# Agents',
        '',
        'Before.',
        '',
        MANAGED_BLOCK_START,
        'OLD',
        MANAGED_BLOCK_END,
        '',
        'After.',
      ].join('\n');
      const next = replaceManagedBlock(doc, '');
      expect(next).not.toContain('OLD');
      expect(next).not.toContain(MANAGED_BLOCK_START);
      expect(next).toContain('Before.');
      expect(next).toContain('After.');
    });
  });
});
