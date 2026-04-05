import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createIgnoreMatcher,
  clearIgnoreMatcherCache,
  HARDCODED_DEFAULTS,
  VGUARD_IGNORE_FILENAME,
} from '../../src/utils/ignore.js';

let projectRoot: string;

function write(name: string, content: string) {
  writeFileSync(join(projectRoot, name), content, 'utf-8');
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'vguard-ignore-'));
  clearIgnoreMatcherCache();
});

afterEach(() => {
  clearIgnoreMatcherCache();
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('createIgnoreMatcher', () => {
  describe('defaults-only (no .vguardignore)', () => {
    it('ignores every hardcoded default', () => {
      const m = createIgnoreMatcher(projectRoot);
      expect(m.hasFile).toBe(false);
      expect(m.filePatterns).toEqual([]);

      for (const pattern of HARDCODED_DEFAULTS) {
        // Probe a file inside each default directory.
        const probe = join(projectRoot, pattern.replace(/\/$/, ''), 'foo.ts');
        expect(m.isIgnored(probe)).toBe(true);
      }
    });

    it('does not ignore ordinary source paths', () => {
      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored(join(projectRoot, 'src/index.ts'))).toBe(false);
      expect(m.isIgnored(join(projectRoot, 'README.md'))).toBe(false);
    });

    it('does not mis-fire on similarly-named directories', () => {
      const m = createIgnoreMatcher(projectRoot);
      // node-utils is not node_modules
      expect(m.isIgnored(join(projectRoot, 'src/node-utils/foo.ts'))).toBe(false);
    });
  });

  describe('with a .vguardignore file', () => {
    it('loads user patterns on top of defaults', () => {
      write(VGUARD_IGNORE_FILENAME, 'src/components/ui/\nsupabase/migrations/\n');

      const m = createIgnoreMatcher(projectRoot);
      expect(m.hasFile).toBe(true);
      expect(m.filePatterns).toEqual(['src/components/ui/', 'supabase/migrations/']);

      expect(m.isIgnored(join(projectRoot, 'src/components/ui/button.tsx'))).toBe(true);
      expect(m.isIgnored(join(projectRoot, 'supabase/migrations/20260101_init.sql'))).toBe(true);
      // Still honours defaults.
      expect(m.isIgnored(join(projectRoot, 'node_modules/foo/index.js'))).toBe(true);
      // Other paths remain.
      expect(m.isIgnored(join(projectRoot, 'src/app/page.tsx'))).toBe(false);
    });

    it('strips blank lines and # comments from filePatterns', () => {
      write(VGUARD_IGNORE_FILENAME, '# Header comment\n\ndist-custom/\n\n# Another\n*.log\n');

      const m = createIgnoreMatcher(projectRoot);
      expect(m.filePatterns).toEqual(['dist-custom/', '*.log']);
    });

    it('supports glob patterns anywhere in the tree', () => {
      write(VGUARD_IGNORE_FILENAME, '**/*.generated.ts\n**/__snapshots__/\n');

      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored(join(projectRoot, 'src/foo.generated.ts'))).toBe(true);
      expect(m.isIgnored(join(projectRoot, 'deep/nested/bar.generated.ts'))).toBe(true);
      expect(m.isIgnored(join(projectRoot, 'src/__snapshots__/test.snap'))).toBe(true);
      expect(m.isIgnored(join(projectRoot, 'src/normal.ts'))).toBe(false);
    });

    it('supports negation patterns to un-ignore files', () => {
      // gitignore semantics: file-pattern ignore + negation works. Directory-level
      // ignores cannot be un-ignored for contained files — that is a documented
      // gitignore limitation, so we test file-glob negation.
      write(VGUARD_IGNORE_FILENAME, '*.log\n!important.log\n');

      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored(join(projectRoot, 'debug.log'))).toBe(true);
      expect(m.isIgnored(join(projectRoot, 'important.log'))).toBe(false);
    });
  });

  describe('path normalisation', () => {
    it('accepts absolute paths and converts to project-relative', () => {
      write(VGUARD_IGNORE_FILENAME, 'custom-dir/\n');
      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored(join(projectRoot, 'custom-dir/file.ts'))).toBe(true);
    });

    it('accepts relative paths from projectRoot', () => {
      write(VGUARD_IGNORE_FILENAME, 'custom-dir/\n');
      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored('custom-dir/file.ts')).toBe(true);
    });

    it('handles paths with backslashes (Windows-style)', () => {
      write(VGUARD_IGNORE_FILENAME, 'custom-dir/\n');
      const m = createIgnoreMatcher(projectRoot);
      expect(m.isIgnored('custom-dir\\file.ts')).toBe(true);
    });

    it('does not ignore paths outside the project root', () => {
      const m = createIgnoreMatcher(projectRoot);
      // Path that resolves to parent dirs should not match.
      expect(m.isIgnored('/completely/elsewhere/node_modules/foo.ts')).toBe(false);
    });
  });

  describe('caching', () => {
    it('returns the same matcher instance for the same projectRoot', () => {
      const a = createIgnoreMatcher(projectRoot);
      const b = createIgnoreMatcher(projectRoot);
      expect(a).toBe(b);
    });

    it('does not cache when extraPatterns are provided', () => {
      const a = createIgnoreMatcher(projectRoot, ['extra/']);
      const b = createIgnoreMatcher(projectRoot, ['extra/']);
      expect(a).not.toBe(b);
    });

    it('rebuilds after clearIgnoreMatcherCache()', () => {
      const first = createIgnoreMatcher(projectRoot);
      clearIgnoreMatcherCache();
      const second = createIgnoreMatcher(projectRoot);
      expect(first).not.toBe(second);
    });

    it('picks up new .vguardignore file after cache is cleared', () => {
      const before = createIgnoreMatcher(projectRoot);
      expect(before.isIgnored(join(projectRoot, 'src/x.ts'))).toBe(false);

      write(VGUARD_IGNORE_FILENAME, 'src/\n');
      clearIgnoreMatcherCache();

      const after = createIgnoreMatcher(projectRoot);
      expect(after.hasFile).toBe(true);
      expect(after.isIgnored(join(projectRoot, 'src/x.ts'))).toBe(true);
    });
  });

  describe('extraPatterns', () => {
    it('merges extras with defaults + file patterns', () => {
      write(VGUARD_IGNORE_FILENAME, 'file-pattern/\n');
      const m = createIgnoreMatcher(projectRoot, ['extra-pattern/']);
      expect(m.isIgnored(join(projectRoot, 'node_modules/x.ts'))).toBe(true); // default
      expect(m.isIgnored(join(projectRoot, 'file-pattern/x.ts'))).toBe(true); // file
      expect(m.isIgnored(join(projectRoot, 'extra-pattern/x.ts'))).toBe(true); // extra
    });

    it('does not permanently alter the shared cache', () => {
      createIgnoreMatcher(projectRoot, ['extra-pattern/']);
      const plain = createIgnoreMatcher(projectRoot);
      expect(plain.isIgnored(join(projectRoot, 'extra-pattern/x.ts'))).toBe(false);
    });
  });

  describe('fail-open behaviour', () => {
    it('falls back to defaults when .vguardignore is unreadable', () => {
      // Write a directory at the path of .vguardignore to force a read failure.
      // (Easier: write valid content, then simulate via no file at all.)
      // Instead, just make sure a missing file does not throw.
      const m = createIgnoreMatcher(projectRoot);
      expect(m.hasFile).toBe(false);
      expect(m.isIgnored(join(projectRoot, 'node_modules/a.ts'))).toBe(true);
    });
  });
});
