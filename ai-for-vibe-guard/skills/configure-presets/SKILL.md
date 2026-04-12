---
name: configure-presets
description: Configure ecosystem presets for VGuard. Use when the user says "add preset", "configure presets", "enable nextjs preset", or wants to add framework-specific guardrails.
args: preset_name
---

# Configure VGuard Presets

Add or modify ecosystem presets in the VGuard configuration. Presets bundle related rules for specific frameworks and tools.

## Available Presets

| Preset              | Description           | Key Rules Included                                           |
| ------------------- | --------------------- | ------------------------------------------------------------ |
| `nextjs-15`         | Next.js 15 App Router | Server/client component boundaries, Route Handlers, metadata |
| `react-19`          | React 19 patterns     | Hook rules, component naming, JSX best practices             |
| `typescript-strict` | Strict TypeScript     | No `any`, explicit return types, strict null checks          |
| `vue`               | Vue 3 Composition API | SFC structure, composables, reactivity                       |
| `svelte`            | Svelte 5              | Runes, component patterns                                    |
| `sveltekit`         | SvelteKit             | Load functions, form actions, routing                        |
| `astro`             | Astro                 | Island architecture, content collections                     |
| `tailwind`          | Tailwind CSS          | Utility-first, no inline styles, class ordering              |
| `supabase`          | Supabase              | RLS policies, client usage, migrations                       |
| `prisma`            | Prisma ORM            | Schema conventions, query optimization                       |
| `express`           | Express.js            | Middleware patterns, error handling, security headers        |
| `django`            | Django                | Model conventions, view patterns, template security          |
| `fastapi`           | FastAPI               | Pydantic models, dependency injection, async patterns        |
| `laravel`           | Laravel               | Eloquent patterns, blade templates, migration conventions    |
| `rails`             | Ruby on Rails         | ActiveRecord, controller conventions                         |
| `react-native`      | React Native          | Platform-specific code, navigation, performance              |

## Step 1: Check Current Presets

Read `vguard.config.ts` and note the current `presets` array.

## Step 2: Add the Preset

Edit the `presets` array in `vguard.config.ts`:

```typescript
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  presets: ['nextjs-15', 'typescript-strict', 'tailwind'], // Add preset here
  agents: ['claude-code'],
});
```

### Preset Stacking

Presets can be combined. Rules from all presets are merged:

- If two presets define the same rule, the **last preset wins**
- You can override any preset rule in the `rules` object

Example — Next.js project with Supabase and Tailwind:

```typescript
presets: ['nextjs-15', 'react-19', 'typescript-strict', 'supabase', 'tailwind'],
```

## Step 3: Regenerate Hooks

```bash
npx vguard generate
```

## Step 4: Verify Active Rules

```bash
npx vguard rules   # Shows all rules enabled by presets + manual config
```

## Notes

- Presets are order-sensitive: later presets override earlier ones for shared rules
- Individual rule overrides in the `rules` object take highest priority
- Use `npx vguard rules --verbose` to see which preset enabled each rule
