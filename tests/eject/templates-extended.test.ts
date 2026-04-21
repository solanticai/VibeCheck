import { describe, it, expect } from 'vitest';

import * as security from '../../src/eject/templates/security.js';
import * as quality from '../../src/eject/templates/quality.js';
import * as workflow from '../../src/eject/templates/workflow.js';
import type { RuleTemplateContext } from '../../src/eject/templates/index.js';

function makeCtx(overrides: Partial<RuleTemplateContext> = {}): RuleTemplateContext {
  return {
    ruleId: 'test/rule',
    severity: 'warn',
    options: {},
    event: 'PreToolUse',
    ...overrides,
  };
}

describe('security templates', () => {
  it('branchProtection embeds protected branches from options', () => {
    const code = security.branchProtection(
      makeCtx({
        ruleId: 'security/branch-protection',
        options: { protectedBranches: ['release'] },
      }),
    );
    expect(code).toContain('release');
    expect(code).toContain('security/branch-protection');
  });

  it('branchProtection defaults to main and master', () => {
    const code = security.branchProtection(makeCtx({ ruleId: 'security/branch-protection' }));
    expect(code).toContain('main');
    expect(code).toContain('master');
  });

  it('destructiveCommands generates command pattern check', () => {
    const code = security.destructiveCommands(
      makeCtx({ ruleId: 'security/destructive-commands', severity: 'block' }),
    );
    expect(code).toContain('DANGEROUS_COMMAND_PATTERNS');
    expect(code).toContain('block');
  });

  it('secretDetection includes allowPatterns from options', () => {
    const code = security.secretDetection(
      makeCtx({ ruleId: 'security/secret-detection', options: { allowPatterns: ['test_key'] } }),
    );
    expect(code).toContain('test_key');
    expect(code).toContain('SECRET_PATTERNS');
  });

  it('promptInjection generates read/fetch tool check', () => {
    const code = security.promptInjection(makeCtx({ ruleId: 'security/prompt-injection' }));
    expect(code).toContain('Read');
    expect(code).toContain('Fetch');
  });

  it('envExposure generates .env write check', () => {
    const code = security.envExposure(makeCtx({ ruleId: 'security/env-exposure' }));
    expect(code).toContain('env-exposure');
  });

  it('rlsRequired generates SQL policy check', () => {
    const code = security.rlsRequired(makeCtx({ ruleId: 'security/rls-required' }));
    expect(code).toContain('rls-required');
  });

  it('dependencyAudit generates dependency check', () => {
    const code = security.dependencyAudit(makeCtx({ ruleId: 'security/dependency-audit' }));
    expect(code).toContain('dependency-audit');
  });
});

describe('quality templates', () => {
  it('antiPatterns respects blockCssFiles option', () => {
    const code = quality.antiPatterns(
      makeCtx({ ruleId: 'quality/anti-patterns', options: { blockCssFiles: true } }),
    );
    expect(code).toContain('CSS file');
  });

  it('antiPatterns respects blockInlineStyles option', () => {
    const code = quality.antiPatterns(
      makeCtx({ ruleId: 'quality/anti-patterns', options: { blockInlineStyles: true } }),
    );
    expect(code).toContain('Inline styles');
  });

  it('antiPatterns respects blockConsoleLog option', () => {
    const code = quality.antiPatterns(
      makeCtx({ ruleId: 'quality/anti-patterns', options: { blockConsoleLog: true } }),
    );
    expect(code).toContain('console.log');
  });

  it('antiPatterns produces minimal code with no options', () => {
    const code = quality.antiPatterns(makeCtx({ ruleId: 'quality/anti-patterns' }));
    expect(code).not.toContain('CSS file');
    expect(code).not.toContain('Inline styles');
  });

  it('importAliases generates import path check', () => {
    const code = quality.importAliases(makeCtx({ ruleId: 'quality/import-aliases' }));
    expect(code).toContain('hasSrcImport');
    expect(code).toContain('hasDeepRelativeImport');
  });

  it('noUseClientInPages checks for use client directive', () => {
    const code = quality.noUseClientInPages(makeCtx({ ruleId: 'quality/no-use-client-in-pages' }));
    expect(code).toContain('no-use-client-in-pages');
  });

  it('noDeprecatedApi generates deprecation check', () => {
    const code = quality.noDeprecatedApi(makeCtx({ ruleId: 'quality/no-deprecated-api' }));
    expect(code).toContain('no-deprecated-api');
    expect(code.toLowerCase()).toContain('deprecated');
    expect(code.toLowerCase()).toContain('warning');
  });

  it('namingConventions generates naming check', () => {
    const code = quality.namingConventions(makeCtx({ ruleId: 'quality/naming-conventions' }));
    expect(code).toContain('naming-conventions');
  });

  it('noConsoleLog generates console.log check', () => {
    const code = quality.noConsoleLog(makeCtx({ ruleId: 'quality/no-console-log' }));
    expect(code).toContain('no-console-log');
  });

  it('maxFileLength generates line count check', () => {
    const code = quality.maxFileLength(makeCtx({ ruleId: 'quality/max-file-length' }));
    expect(code).toContain('max-file-length');
  });

  it('hallucinationGuard generates hallucination check', () => {
    const code = quality.hallucinationGuard(makeCtx({ ruleId: 'quality/hallucination-guard' }));
    expect(code).toContain('hallucination-guard');
  });

  it('testCoverage generates coverage check', () => {
    const code = quality.testCoverage(makeCtx({ ruleId: 'quality/test-coverage' }));
    expect(code).toContain('test-coverage');
  });

  it('fileStructure generates structure check', () => {
    const code = quality.fileStructure(makeCtx({ ruleId: 'quality/file-structure' }));
    expect(code).toContain('file-structure');
  });

  it('deadExports generates export check', () => {
    const code = quality.deadExports(makeCtx({ ruleId: 'quality/dead-exports' }));
    expect(code).toContain('dead-exports');
  });
});

describe('workflow templates', () => {
  it('commitConventions embeds custom types', () => {
    const code = workflow.commitConventions(
      makeCtx({ ruleId: 'workflow/commit-conventions', options: { types: ['feat', 'fix'] } }),
    );
    expect(code).toContain('feat');
    expect(code).toContain('fix');
    expect(code).toContain('commit-conventions');
  });

  it('commitConventions defaults to standard types', () => {
    const code = workflow.commitConventions(makeCtx({ ruleId: 'workflow/commit-conventions' }));
    expect(code).toContain('refactor');
    expect(code).toContain('chore');
  });

  it('migrationSafety generates SQL pattern check', () => {
    const code = workflow.migrationSafety(makeCtx({ ruleId: 'workflow/migration-safety' }));
    expect(code).toContain('DANGEROUS_SQL_PATTERNS');
    expect(code).toContain("'sql'");
  });

  it('changelogReminder generates diff-based check', () => {
    const code = workflow.changelogReminder(makeCtx({ ruleId: 'workflow/changelog-reminder' }));
    expect(code).toContain('CHANGELOG.md');
    expect(code).toContain('changelog-reminder');
  });

  it('todoTracker generates TODO/FIXME marker check', () => {
    const code = workflow.todoTracker(makeCtx({ ruleId: 'workflow/todo-tracker' }));
    expect(code).toContain('TODO');
    expect(code).toContain('FIXME');
    expect(code).toContain('HACK');
  });

  it('prReminder generates push/remote check', () => {
    const code = workflow.prReminder(makeCtx({ ruleId: 'workflow/pr-reminder' }));
    expect(code).toContain('unpushedCount');
    expect(code).toContain('hasRemote');
  });

  it('formatOnSave generates formatter detection for various languages', () => {
    const code = workflow.formatOnSave(makeCtx({ ruleId: 'workflow/format-on-save' }));
    expect(code).toContain('Black');
    expect(code).toContain('gofmt');
    expect(code).toContain('rustfmt');
    expect(code).toContain('Prettier');
    expect(code).toContain('Biome');
  });

  it('reviewGate generates protected branch direct-commit check', () => {
    const code = workflow.reviewGate(makeCtx({ ruleId: 'workflow/review-gate' }));
    expect(code).toContain('review-gate');
    expect(code).toContain('pull request');
  });
});

describe('all templates produce valid JavaScript comments', () => {
  const allTemplates = [
    { name: 'branchProtection', fn: security.branchProtection, id: 'security/branch-protection' },
    {
      name: 'destructiveCommands',
      fn: security.destructiveCommands,
      id: 'security/destructive-commands',
    },
    { name: 'secretDetection', fn: security.secretDetection, id: 'security/secret-detection' },
    {
      name: 'commitConventions',
      fn: workflow.commitConventions,
      id: 'workflow/commit-conventions',
    },
    { name: 'migrationSafety', fn: workflow.migrationSafety, id: 'workflow/migration-safety' },
    {
      name: 'changelogReminder',
      fn: workflow.changelogReminder,
      id: 'workflow/changelog-reminder',
    },
    { name: 'todoTracker', fn: workflow.todoTracker, id: 'workflow/todo-tracker' },
    { name: 'prReminder', fn: workflow.prReminder, id: 'workflow/pr-reminder' },
    { name: 'formatOnSave', fn: workflow.formatOnSave, id: 'workflow/format-on-save' },
    { name: 'reviewGate', fn: workflow.reviewGate, id: 'workflow/review-gate' },
  ];

  for (const { name, fn, id } of allTemplates) {
    it(`${name} starts with a JS comment containing the rule ID`, () => {
      const code = fn(makeCtx({ ruleId: id }));
      expect(code.trimStart()).toMatch(/^\/\//);
      expect(code).toContain(id);
    });
  }
});
