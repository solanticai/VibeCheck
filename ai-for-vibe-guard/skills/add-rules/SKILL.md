---
name: add-rules
description: Add or enable guardrail rules in a VGuard project. Use when the user says "add rule", "enable rule", "turn on rule", or wants to configure specific guardrail checks.
args: rule_name
---

# Add VGuard Rules

Enable or configure specific guardrail rules in the project's VGuard configuration.

## Available Rule Categories

| Category | Rules | Purpose |
|----------|-------|---------|
| **security** | secrets-in-code, sql-injection, command-injection, path-traversal, xss-prevention, branch-protection, env-file-protection | Prevent security vulnerabilities |
| **quality** | import-aliases, naming-conventions, dead-exports, no-console-log, no-any-type, file-length, function-length, no-magic-numbers, consistent-error-handling, no-hardcoded-urls, barrel-exports | Enforce code quality standards |
| **workflow** | commit-conventions, pr-reminder, branch-naming, changelog-update, test-before-commit, documentation-update, no-wip-commits | Maintain workflow discipline |
| **testing** | test-coverage, mock-cleanup, snapshot-abuse, test-naming, no-skipped-tests | Ensure testing best practices |
| **maintainability** | cyclomatic-complexity, max-nesting-depth, file-organization, dependency-management | Keep code maintainable |
| **performance** | bundle-size, image-optimization, lazy-loading | Prevent performance regressions |
| **reliability** | unhandled-promises | Improve runtime reliability |

## Step 1: Check Current Rules

Read `vguard.config.ts` to see currently enabled rules and presets. Rules are configured in the `rules` object:

```typescript
export default defineConfig({
  presets: ['nextjs-15'],
  rules: {
    'security/secrets-in-code': { severity: 'block' },
    'quality/no-any-type': { severity: 'warn' },
  },
});
```

## Step 2: Add the Rule

Add the desired rule to the `rules` object in `vguard.config.ts`:

```typescript
rules: {
  '<category>/<rule-name>': {
    severity: 'block' | 'warn' | 'info',
    // Optional: override default settings
    enabled: true,
  },
}
```

### Severity Levels

- **`block`**: Prevents the AI agent from proceeding (Claude Code only)
- **`warn`**: Allows the operation but shows a warning
- **`info`**: Informational only, logged but no visible feedback

## Step 3: Regenerate Hooks

```bash
npx vguard generate
```

## Step 4: Verify

```bash
npx vguard rules  # Confirm the rule is now active
```

## Common Rule Configurations

### Strict Security

```typescript
rules: {
  'security/secrets-in-code': { severity: 'block' },
  'security/sql-injection': { severity: 'block' },
  'security/command-injection': { severity: 'block' },
  'security/env-file-protection': { severity: 'block' },
}
```

### Code Quality

```typescript
rules: {
  'quality/no-any-type': { severity: 'warn' },
  'quality/naming-conventions': { severity: 'warn' },
  'quality/no-console-log': { severity: 'warn' },
  'quality/file-length': { severity: 'warn' },
}
```

### Workflow Enforcement

```typescript
rules: {
  'workflow/commit-conventions': { severity: 'block' },
  'workflow/branch-naming': { severity: 'warn' },
  'workflow/test-before-commit': { severity: 'warn' },
}
```

## Notes

- Rules from presets can be overridden in the `rules` object
- Set `enabled: false` to disable a rule that a preset enables
- Rules are matched by `<category>/<rule-name>` format
