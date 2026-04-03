---
name: new-preset
description: Scaffold a new VGuard preset for a tech stack or framework. Use when the user says "create a preset", "add preset", or wants to bundle rules for an ecosystem like Remix, Drizzle, etc.
args: preset_name
---

# Create New VGuard Preset: $ARGUMENTS

Generate a VGuard preset that bundles rule configurations for a tech stack.

## What This Skill Creates

1. **Preset file** at `src/presets/<preset-id>.ts`
2. **Registration** in `src/presets/index.ts`

## Required Information

Ask the user for these if not provided:
- **Preset ID**: kebab-case (e.g., `remix`, `drizzle-orm`)
- **Name**: Human-readable (e.g., `Remix`, `Drizzle ORM`)
- **Description**: What conventions this preset enforces
- **Rules**: Which existing rules to include and their configuration

## Implementation Steps

### 1. Create Preset File

Use the template at `.claude/skills/new-preset/templates/preset.ts`.

Review existing presets in `src/presets/` for reference patterns:
- `nextjs-15.ts` — enables quality rules for Next.js
- `typescript-strict.ts` — enforces strict TypeScript rules
- `supabase.ts` — enables database-specific rules

### 2. Register the Preset

In `src/presets/index.ts`, add:
```typescript
import { <presetVarName> } from './<preset-id>.js';
registerPreset(<presetVarName>);
```

### 3. Verify

```bash
npm run type-check
npm test
```

## Conventions

- Presets bundle rule configurations — they don't create new rules
- Set `version: '1.0.0'` for new presets
- Presets can enable rules with `true` or configure them with options
- Presets can only downgrade severity from defaults, never upgrade
