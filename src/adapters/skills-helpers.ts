/**
 * Shared helpers for the per-agent skill writers.
 *
 * The 8 companion skills live under `ai-for-vibe-guard/skills/<id>/SKILL.md`
 * and ship with the published @anthril/vguard tarball (see the `files` array
 * in package.json). At install time we resolve their source path relative
 * to this file, parse each SKILL.md frontmatter, and let each adapter write
 * them out in its native format.
 *
 * Managed-block strategy (for append-style targets like codex / opencode):
 * we wrap VGuard-owned content between sentinel comments so re-runs replace
 * cleanly without trashing user edits outside the block.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SkillFrontmatter {
  name: string;
  description: string;
  args?: string;
  [key: string]: unknown;
}

export interface SourceSkill {
  id: string;
  sourcePath: string;
  body: string;
  frontmatter: SkillFrontmatter;
}

export const MANAGED_BLOCK_START = '<!-- vguard-skills:start -->';
export const MANAGED_BLOCK_END = '<!-- vguard-skills:end -->';

/**
 * Candidate locations for the source skills directory, in priority order.
 * We search these at install time and take the first that exists:
 *
 * 1. Monorepo dev layout: `<repo>/ai-for-vibe-guard/skills/` relative to
 *    this compiled adapter file (used when vguard is itself being
 *    developed locally or when tests run).
 * 2. Installed-package layout: inside node_modules, the adapter sits at
 *    `node_modules/@anthril/vguard/dist/adapters/skills-helpers.{js,cjs}`,
 *    so the skills ship two directories up.
 */
function candidateSkillRoots(): string[] {
  return [
    // dev layout — adapter compiled at <root>/dist/adapters/*
    join(__dirname, '..', '..', 'ai-for-vibe-guard', 'skills'),
    // alternative dev layout — adapter compiled at <root>/dist/*
    join(__dirname, '..', 'ai-for-vibe-guard', 'skills'),
    // installed-package fallback
    join(__dirname, '..', '..', '..', 'ai-for-vibe-guard', 'skills'),
  ];
}

export function resolveSkillsSourceRoot(override?: string): string | null {
  const roots = override ? [override, ...candidateSkillRoots()] : candidateSkillRoots();
  for (const root of roots) {
    try {
      if (existsSync(root) && statSync(root).isDirectory()) return root;
    } catch {
      // Fall through to next candidate.
    }
  }
  return null;
}

function parseFrontmatter(raw: string): { fm: SkillFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { fm: { name: '', description: '' }, body: raw };
  const fmRaw = match[1];
  const body = match[2];
  const fm: SkillFrontmatter = { name: '', description: '' };
  for (const line of fmRaw.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    fm[kv[1]] = value;
  }
  return { fm, body };
}

/**
 * List every source skill bundled with the package. Returns an empty array
 * if the skills directory cannot be located (e.g. the package was installed
 * without the `ai-for-vibe-guard` folder).
 */
export function listSourceSkills(rootOverride?: string): SourceSkill[] {
  const root = resolveSkillsSourceRoot(rootOverride);
  if (!root) return [];

  const skills: SourceSkill[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(root, entry.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    try {
      const raw = readFileSync(skillPath, 'utf8');
      const { fm, body } = parseFrontmatter(raw);
      if (!fm.name) fm.name = entry.name;
      skills.push({ id: entry.name, sourcePath: skillPath, body, frontmatter: fm });
    } catch {
      // Corrupt skill file — skip it rather than exploding.
    }
  }
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return skills;
}

export function filterSkills(skills: SourceSkill[], ids: readonly string[] | 'all'): SourceSkill[] {
  if (ids === 'all') return skills;
  const wanted = new Set(ids);
  return skills.filter((s) => wanted.has(s.id));
}

/**
 * Replace a managed block in an existing document. If the block is absent,
 * the new content is appended. If `newContent` is empty, the block is
 * removed entirely (trailing newline also trimmed).
 */
export function replaceManagedBlock(existing: string, newContent: string): string {
  const open = existing.indexOf(MANAGED_BLOCK_START);
  const close = existing.indexOf(MANAGED_BLOCK_END);

  if (open >= 0 && close > open) {
    const before = existing.slice(0, open).replace(/\s+$/, '');
    const after = existing.slice(close + MANAGED_BLOCK_END.length).replace(/^\s+/, '');
    if (!newContent) {
      return [before, after].filter(Boolean).join('\n\n');
    }
    return [before, newContent, after].filter(Boolean).join('\n\n');
  }

  if (!newContent) return existing;
  const tail = existing.endsWith('\n') ? existing : `${existing}\n`;
  return `${tail}\n${newContent}\n`;
}

/**
 * Render a set of skills into the body of a managed block for append-style
 * targets (codex AGENTS.md, opencode instructions.md).
 */
export function renderManagedBlock(skills: SourceSkill[]): string {
  if (skills.length === 0) return '';
  const sections = skills.map((s) => {
    const title = `## VGuard Skill: ${s.frontmatter.name || s.id}`;
    const desc = s.frontmatter.description
      ? `_${s.frontmatter.description}_\n\n`
      : '';
    return `${title}\n\n${desc}${s.body.trim()}\n`;
  });
  return [MANAGED_BLOCK_START, ...sections, MANAGED_BLOCK_END].join('\n\n');
}
