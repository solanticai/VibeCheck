---
name: setup-vguard
description: Install and configure VGuard in a project. Use when the user says "install vguard", "set up guardrails", "add vguard", or wants to add AI coding guardrails to their project.
args: framework
---

# Set Up VGuard

Install and configure VGuard — AI coding guardrails — in the current project.

## Step 1: Detect Framework

Inspect the project to determine the tech stack:

- Read `package.json` for dependencies (next, react, vue, svelte, express, etc.)
- Check for `tsconfig.json` (TypeScript)
- Check for `tailwind.config.*` (Tailwind CSS)
- Check for framework-specific files (`next.config.*`, `nuxt.config.*`, `astro.config.*`, etc.)
- Check for `requirements.txt` or `pyproject.toml` (Python/Django/FastAPI)

## Step 2: Install VGuard

```bash
npm install -D @anthril/vguard
```

For other package managers:

- `yarn add -D @anthril/vguard`
- `pnpm add -D @anthril/vguard`
- `bun add -D @anthril/vguard`

## Step 3: Initialize

```bash
npx vguard init
```

This creates `vguard.config.ts` with sensible defaults. Use `--force` to overwrite an existing config.

## Step 4: Select Presets

Based on the detected framework, add the relevant presets to `vguard.config.ts`:

| Framework        | Preset(s)                                    |
| ---------------- | -------------------------------------------- |
| Next.js          | `nextjs-15`, `react-19`, `typescript-strict` |
| React            | `react-19`, `typescript-strict`              |
| Vue              | `vue`, `typescript-strict`                   |
| Svelte/SvelteKit | `svelte` or `sveltekit`, `typescript-strict` |
| Astro            | `astro`, `typescript-strict`                 |
| Express          | `express`, `typescript-strict`               |
| Django           | `django`                                     |
| FastAPI          | `fastapi`                                    |
| Laravel          | `laravel`                                    |
| Rails            | `rails`                                      |

If using Tailwind CSS, also add `tailwind`. If using Supabase, add `supabase`.
If using Prisma, add `prisma`.

Example config:

```typescript
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  presets: ['nextjs-15', 'typescript-strict', 'tailwind'],
  agents: ['claude-code'],
});
```

## Step 5: Generate Hooks

```bash
npx vguard generate
```

This generates hook files for the configured agent(s):

- **Claude Code**: Creates entries in `.claude/settings.json` hooks
- **Cursor**: Creates `.cursorrules` file
- **Codex**: Creates `AGENTS.md` file
- **OpenCode**: Creates `instructions.md` file

## Step 6: Verify

```bash
npx vguard rules    # List all active rules
npx vguard lint     # Check config validity
npm run type-check  # Ensure no type errors introduced
```

## Notes

- VGuard requires Node.js >= 20.0.0
- The `agents` field in config determines which adapter generates hook files
- Presets can be stacked — rules from multiple presets are merged
- Individual rules can be overridden in the `rules` object of the config
