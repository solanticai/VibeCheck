import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  injectPackageJsonScripts,
  writeCommandsReference,
  renderCommandsMarkdown,
} from '../../src/utils/project-scripts.js';
import { VGUARD_COMMANDS } from '../../src/utils/command-registry.js';

describe('utils/project-scripts', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'vguard-project-scripts-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  describe('injectPackageJsonScripts', () => {
    it('adds every vguard:* script when package.json has no scripts', async () => {
      const pkgPath = join(projectRoot, 'package.json');
      await writeFile(pkgPath, JSON.stringify({ name: 'fixture', version: '0.0.0' }), 'utf-8');

      const result = await injectPackageJsonScripts(projectRoot);

      expect(result.noPackageJson).toBe(false);
      expect(result.added).toBe(VGUARD_COMMANDS.length);
      expect(result.skipped).toBe(0);

      const written = JSON.parse(await readFile(pkgPath, 'utf-8'));
      expect(Object.keys(written.scripts)).toHaveLength(VGUARD_COMMANDS.length);

      for (const cmd of VGUARD_COMMANDS) {
        expect(written.scripts[cmd.scriptName]).toBe(cmd.cliInvocation);
      }
    });

    it('leaves existing scripts untouched and reports them as skipped', async () => {
      const pkgPath = join(projectRoot, 'package.json');
      await writeFile(
        pkgPath,
        JSON.stringify({
          name: 'fixture',
          version: '0.0.0',
          scripts: {
            'vguard:lint': 'custom-lint-command',
            test: 'jest',
          },
        }),
        'utf-8',
      );

      const result = await injectPackageJsonScripts(projectRoot);

      expect(result.added).toBe(VGUARD_COMMANDS.length - 1);
      expect(result.skipped).toBe(1);

      const written = JSON.parse(await readFile(pkgPath, 'utf-8'));
      // User's custom script is preserved.
      expect(written.scripts['vguard:lint']).toBe('custom-lint-command');
      // Unrelated scripts are preserved.
      expect(written.scripts.test).toBe('jest');
    });

    it('is idempotent when run a second time', async () => {
      const pkgPath = join(projectRoot, 'package.json');
      await writeFile(pkgPath, JSON.stringify({ name: 'fixture', version: '0.0.0' }), 'utf-8');

      const first = await injectPackageJsonScripts(projectRoot);
      const second = await injectPackageJsonScripts(projectRoot);

      expect(first.added).toBe(VGUARD_COMMANDS.length);
      expect(second.added).toBe(0);
      expect(second.skipped).toBe(VGUARD_COMMANDS.length);
    });

    it('no-ops silently when package.json is missing', async () => {
      const result = await injectPackageJsonScripts(projectRoot);

      expect(result.noPackageJson).toBe(true);
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('fails open on malformed package.json', async () => {
      const pkgPath = join(projectRoot, 'package.json');
      await writeFile(pkgPath, '{ not valid json', 'utf-8');

      const result = await injectPackageJsonScripts(projectRoot);

      expect(result.noPackageJson).toBe(false);
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);

      // Original content is preserved.
      const content = await readFile(pkgPath, 'utf-8');
      expect(content).toBe('{ not valid json');
    });

    it('writes package.json with a trailing newline', async () => {
      const pkgPath = join(projectRoot, 'package.json');
      await writeFile(pkgPath, JSON.stringify({ name: 'fixture', version: '0.0.0' }), 'utf-8');

      await injectPackageJsonScripts(projectRoot);

      const content = await readFile(pkgPath, 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('writeCommandsReference', () => {
    it('creates .vguard/COMMANDS.md at the project root', async () => {
      await writeCommandsReference(projectRoot);

      const outPath = join(projectRoot, '.vguard', 'COMMANDS.md');
      expect(existsSync(outPath)).toBe(true);
    });

    it('includes every command from the registry', async () => {
      await writeCommandsReference(projectRoot);

      const content = await readFile(join(projectRoot, '.vguard', 'COMMANDS.md'), 'utf-8');
      for (const cmd of VGUARD_COMMANDS) {
        expect(content).toContain(cmd.scriptName);
        expect(content).toContain(cmd.description);
      }
    });

    it('overwrites existing COMMANDS.md', async () => {
      await writeCommandsReference(projectRoot);
      const outPath = join(projectRoot, '.vguard', 'COMMANDS.md');
      await writeFile(outPath, 'stale content', 'utf-8');

      await writeCommandsReference(projectRoot);

      const content = await readFile(outPath, 'utf-8');
      expect(content).not.toBe('stale content');
      expect(content).toContain('VGuard — Project Commands');
    });
  });

  describe('renderCommandsMarkdown', () => {
    it('produces markdown with all category sections', () => {
      const md = renderCommandsMarkdown();

      expect(md).toContain('# VGuard — Project Commands');
      expect(md).toContain('## Setup & Configuration');
      expect(md).toContain('## Quality Checks');
      expect(md).toContain('## Analysis & Reporting');
      expect(md).toContain('## Rules & Maintenance');
      expect(md).toContain('## VGuard Cloud');
    });

    it('documents the npm passthrough pattern for argument-taking commands', () => {
      const md = renderCommandsMarkdown();

      expect(md).toContain('npm run vguard:add -- security/branch-protection');
    });

    it('includes the regeneration warning comment', () => {
      const md = renderCommandsMarkdown();
      expect(md).toContain('regenerated automatically');
    });
  });
});
