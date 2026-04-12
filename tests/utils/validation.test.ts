import { describe, it, expect } from 'vitest';
import {
  isValidNpmPackageName,
  isValidFilePath,
  isValidHookEvent,
  VALID_HOOK_EVENTS,
} from '../../src/utils/validation.js';

describe('isValidNpmPackageName', () => {
  it('accepts valid unscoped names', () => {
    expect(isValidNpmPackageName('lodash')).toBe(true);
    expect(isValidNpmPackageName('react-dom')).toBe(true);
    expect(isValidNpmPackageName('my-package')).toBe(true);
    expect(isValidNpmPackageName('vitest')).toBe(true);
  });

  it('accepts valid scoped names', () => {
    expect(isValidNpmPackageName('@scope/name')).toBe(true);
    expect(isValidNpmPackageName('@anthril/vguard')).toBe(true);
    expect(isValidNpmPackageName('@types/node')).toBe(true);
  });

  it('rejects names with shell metacharacters', () => {
    expect(isValidNpmPackageName('package;rm -rf')).toBe(false);
    expect(isValidNpmPackageName('package|evil')).toBe(false);
    expect(isValidNpmPackageName('package`cmd`')).toBe(false);
    expect(isValidNpmPackageName('pack$(age)')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidNpmPackageName('')).toBe(false);
  });

  it('rejects names over 214 chars', () => {
    const longName = 'a'.repeat(215);
    expect(isValidNpmPackageName(longName)).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(isValidNpmPackageName('my package')).toBe(false);
  });

  it('rejects names starting with uppercase', () => {
    expect(isValidNpmPackageName('MyPackage')).toBe(false);
  });
});

describe('isValidFilePath', () => {
  it('accepts normal file paths', () => {
    expect(isValidFilePath('/project/src/index.ts')).toBe(true);
    expect(isValidFilePath('C:\\Users\\test\\file.js')).toBe(true);
    expect(isValidFilePath('./relative/path.ts')).toBe(true);
  });

  it('accepts paths with spaces', () => {
    expect(isValidFilePath('/project/my dir/file.ts')).toBe(true);
    expect(isValidFilePath('C:\\Users\\John Doe\\file.js')).toBe(true);
  });

  it('rejects paths with semicolons (shell injection)', () => {
    expect(isValidFilePath('/project/src/index.ts; rm -rf /')).toBe(false);
  });

  it('rejects paths with backticks', () => {
    expect(isValidFilePath('/project/`whoami`.ts')).toBe(false);
  });

  it('rejects paths with pipe characters', () => {
    expect(isValidFilePath('/project/file.ts | cat /etc/passwd')).toBe(false);
  });

  it('rejects paths with null bytes', () => {
    expect(isValidFilePath('/project/file.ts\0evil')).toBe(false);
  });

  it('rejects paths with ampersand', () => {
    expect(isValidFilePath('/project/file.ts & echo pwned')).toBe(false);
  });

  it('rejects paths with $() subshell', () => {
    expect(isValidFilePath('/project/$(whoami)/file.ts')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidFilePath('')).toBe(false);
  });
});

describe('isValidHookEvent', () => {
  it('accepts all valid events', () => {
    for (const event of VALID_HOOK_EVENTS) {
      expect(isValidHookEvent(event)).toBe(true);
    }
  });

  it('accepts specific known events', () => {
    expect(isValidHookEvent('PreToolUse')).toBe(true);
    expect(isValidHookEvent('PostToolUse')).toBe(true);
    expect(isValidHookEvent('Stop')).toBe(true);
    expect(isValidHookEvent('SessionStart')).toBe(true);
    expect(isValidHookEvent('UserPromptSubmit')).toBe(true);
  });

  it('rejects unknown event strings', () => {
    expect(isValidHookEvent('Unknown')).toBe(false);
    expect(isValidHookEvent('pretooluse')).toBe(false); // case-sensitive
    expect(isValidHookEvent('PRETOOLUSE')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidHookEvent('')).toBe(false);
  });
});
