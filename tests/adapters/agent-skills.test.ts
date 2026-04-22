import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listSourceSkills, filterSkills } from '../../src/adapters/skills-helpers.js';
import {
  installClaudeCodeSkills,
  removeClaudeCodeSkills,
} from '../../src/adapters/claude-code/skills.js';
import { installCursorSkills, removeCursorSkills } from '../../src/adapters/cursor/skills.js';
import { installCodexSkills, removeCodexSkills } from '../../src/adapters/codex/skills.js';
import { installOpenCodeSkills, removeOpenCodeSkills } from '../../src/adapters/opencode/skills.js';

describe('per-agent skill writers', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'vguard-skills-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const skills = () => filterSkills(listSourceSkills(), ['setup-vguard']);

  it('claude-code writes native SKILL.md and stamps vguardVersion frontmatter', () => {
    const result = installClaudeCodeSkills(skills(), tmpRoot, '9.9.9');
    expect(result.installed).toEqual(['setup-vguard']);

    const target = join(tmpRoot, '.claude', 'skills', 'setup-vguard', 'SKILL.md');
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, 'utf8');
    expect(content).toContain('vguardVersion: 9.9.9');

    const removed = removeClaudeCodeSkills(['setup-vguard'], tmpRoot);
    expect(removed.removed).toEqual(['setup-vguard']);
    expect(existsSync(target)).toBe(false);
  });

  it('cursor writes one .mdc per skill with vguardVersion in frontmatter', () => {
    const result = installCursorSkills(skills(), tmpRoot, '9.9.9');
    expect(result.installed).toEqual(['setup-vguard']);

    const target = join(tmpRoot, '.cursor', 'rules', 'vguard-skill-setup-vguard.mdc');
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, 'utf8');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('vguardSkill: setup-vguard');
    expect(content).toContain('vguardVersion: 9.9.9');

    const removed = removeCursorSkills(['setup-vguard'], tmpRoot);
    expect(removed.removed).toEqual(['setup-vguard']);
    expect(existsSync(target)).toBe(false);
  });

  it('codex writes a managed block into AGENTS.md', () => {
    const target = join(tmpRoot, 'AGENTS.md');
    writeFileSync(target, '# Agents\n\nMy own content.\n', 'utf8');

    installCodexSkills(skills(), tmpRoot, '9.9.9');

    const content = readFileSync(target, 'utf8');
    expect(content).toContain('My own content.');
    expect(content).toContain('<!-- vguard-skills:start -->');
    expect(content).toContain('<!-- vguard v9.9.9 -->');
    expect(content).toContain('<!-- vguard-skills:end -->');
    expect(content).toContain('VGuard Skill');

    removeCodexSkills(['setup-vguard'], tmpRoot);
    const afterRemove = readFileSync(target, 'utf8');
    expect(afterRemove).not.toContain('vguard-skills:start');
    expect(afterRemove).toContain('My own content.');
  });

  it('opencode writes a managed block into .opencode/instructions.md', () => {
    installOpenCodeSkills(skills(), tmpRoot, '9.9.9');

    const target = join(tmpRoot, '.opencode', 'instructions.md');
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, 'utf8');
    expect(content).toContain('<!-- vguard-skills:start -->');
    expect(content).toContain('<!-- vguard v9.9.9 -->');
    expect(content).toContain('VGuard Skill');

    removeOpenCodeSkills(['setup-vguard'], tmpRoot);
    const afterRemove = readFileSync(target, 'utf8');
    expect(afterRemove).not.toContain('vguard-skills:start');
  });

  it('second install replaces managed block in place (idempotent)', () => {
    installCodexSkills(skills(), tmpRoot, '1.0.0');
    installCodexSkills(skills(), tmpRoot, '2.0.0');

    const content = readFileSync(join(tmpRoot, 'AGENTS.md'), 'utf8');
    // Only the latest version is present; old version tag is gone.
    expect(content).toContain('<!-- vguard v2.0.0 -->');
    expect(content).not.toContain('<!-- vguard v1.0.0 -->');
  });
});
