Scaffold a new VGuard rule following project conventions.

## Steps

1. Ask the user for:
   - **Category**: `security`, `quality`, or `workflow`
   - **Rule name**: kebab-case (e.g., `no-hardcoded-urls`)
   - **Description**: What this rule prevents and why
   - **Severity**: `block`, `warn`, or `info`
   - **Events**: Which hook events trigger this rule (`PreToolUse`, `PostToolUse`, `Stop`)
   - **Tools**: Which tools it matches (e.g., `Edit`, `Write`, `Bash`)

2. Create the rule file at `src/rules/<category>/<rule-name>.ts` using the template at `.claude/skills/new-rule/templates/rule.ts`

3. Register the rule in `src/rules/<category>/index.ts`:
   - Import the rule
   - Add it to `registerRules()` call

4. Create the test file at `tests/rules/<category>/<rule-name>.test.ts` using the template at `.claude/skills/new-rule/templates/rule.test.ts`

5. Add the rule to relevant presets in `src/presets/` if applicable

6. Run verification:
   ```bash
   npm run type-check
   npm test -- --reporter verbose tests/rules/<category>/<rule-name>.test.ts
   ```

## Conventions

- Rule IDs follow `category/rule-name` format
- Severity can only be downgraded by presets, never upgraded
- Rules must be async-capable (return `Promise<RuleResult> | RuleResult`)
- Use `editCheck: true` for Write rules to auto-generate Edit variants via `createEditVariant()`
- Follow the fail-open philosophy: internal errors return `{ status: 'pass' }`
