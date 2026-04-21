import { describe, it, expect } from 'vitest';
import { isGitCommitCommand } from '../../../src/rules/workflow/helpers/git-commit-intent.js';

describe('helpers/isGitCommitCommand', () => {
  it('detects a plain git commit', () => {
    expect(isGitCommitCommand('git commit -m "msg"')).toBe(true);
  });

  it('detects git commit with leading whitespace', () => {
    expect(isGitCommitCommand('   git commit -am "wip"')).toBe(true);
  });

  it('detects git commit --amend', () => {
    expect(isGitCommitCommand('git commit --amend --no-edit')).toBe(true);
  });

  it('detects git commit after &&', () => {
    expect(isGitCommitCommand('git add . && git commit -m "x"')).toBe(true);
  });

  it('detects git commit after ;', () => {
    expect(isGitCommitCommand('git status; git commit -m "x"')).toBe(true);
  });

  it('ignores git commit-tree', () => {
    expect(isGitCommitCommand('git commit-tree abc123')).toBe(false);
  });

  it('ignores git commits-graph', () => {
    expect(isGitCommitCommand('git commits-graph --write')).toBe(false);
  });

  it('returns false for non-commit commands', () => {
    expect(isGitCommitCommand('git push')).toBe(false);
    expect(isGitCommitCommand('npm test')).toBe(false);
    expect(isGitCommitCommand('')).toBe(false);
    expect(isGitCommitCommand(undefined)).toBe(false);
  });

  it('handles pipes and logical operators', () => {
    expect(isGitCommitCommand('cat file | git commit -m "msg"')).toBe(true);
    expect(isGitCommitCommand('false || git commit -m "msg"')).toBe(true);
  });
});
