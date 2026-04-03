---
name: new-rule
description: Scaffold a new VGuard rule with source file, test, and preset registration. Use when the user says "create a rule", "add a new rule", "scaffold rule", or wants to implement a new guardrail check.
args: rule_name
---

# Create New VGuard Rule: $ARGUMENTS

Generate a complete VGuard rule following project conventions.

## What This Skill Creates

1. **Rule file** at `src/rules/<category>/<rule-name>.ts`
2. **Test file** at `tests/rules/<category>/<rule-name>.test.ts`
3. **Registration** in `src/rules/<category>/index.ts`
4. **Preset entry** (optional) in relevant preset files

## Required Information

Ask the user for these if not provided:
- **Category**: `security`, `quality`, or `workflow`
- **Rule name**: kebab-case identifier (e.g., `no-hardcoded-urls`)
- **Description**: What this rule prevents and why
- **Severity**: `block` (prevents operation), `warn` (allows but warns), `info` (informational)
- **Events**: `PreToolUse`, `PostToolUse`, `Stop`, or a combination
- **Tools**: Which tools to match (e.g., `Edit`, `Write`, `Bash`, `Read`)
- **File patterns** (optional): Globs to match (e.g., `*.ts`, `*.sql`)

## Implementation Steps

### 1. Create Rule File

Use the template at `.claude/skills/new-rule/templates/rule.ts`. Key requirements:
- Export a `Rule` object satisfying the interface in `src/types.ts`
- The `check()` function receives `HookContext` and returns `RuleResult`
- Use `editCheck: true` if the rule applies to Write events (auto-generates Edit variant)
- Follow fail-open: wrap in try/catch, return `{ status: 'pass' }` on error

### 2. Register the Rule

In `src/rules/<category>/index.ts`, add:
```typescript
import { <ruleName> } from './<rule-name>.js';
registerRules([<ruleName>]);
```

### 3. Create Test File

Use the template at `.claude/skills/new-rule/templates/rule.test.ts`. Must include:
- Test for the pass case (rule allows valid input)
- Test for the block/warn case (rule catches violations)
- Test for edge cases (empty input, missing fields)
- Test that internal errors return `{ status: 'pass' }` (fail-open)

### 4. Add to Presets (Optional)

If the rule is relevant to a specific preset (e.g., a Next.js-specific rule), add it to the preset's `rules` object in `src/presets/<preset>.ts`.

### 5. Verify

```bash
npm run type-check
npm test -- --reporter verbose tests/rules/<category>/<rule-name>.test.ts
npm test
```
