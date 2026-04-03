Scaffold a new VGuard preset for an ecosystem or tech stack.

## Steps

1. Ask the user for:
   - **Preset ID**: kebab-case (e.g., `remix`, `drizzle-orm`)
   - **Name**: Human-readable (e.g., `Remix`)
   - **Description**: What conventions this preset enforces
   - **Rules**: Which existing rules to include and their configuration

2. Create the preset file at `src/presets/<preset-id>.ts` using the template at `.claude/skills/new-preset/templates/preset.ts`

3. Register the preset in `src/presets/index.ts`:
   - Import the preset
   - Add `registerPreset(<preset>)` call

4. Run verification:
   ```bash
   npm run type-check
   npm test -- --reporter verbose tests/presets/
   ```

## Conventions

- Presets bundle rule configurations for a tech stack
- Presets can enable rules and set their options, but cannot upgrade severity
- The `version` field should start at `'1.0.0'` and follow semver
- Rules referenced in presets must already exist as built-in or plugin rules
