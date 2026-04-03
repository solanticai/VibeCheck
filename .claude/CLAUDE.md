# VGuard — Project Instructions

## What is VGuard?

VGuard (VibeGuard) is a runtime-enforced AI coding guardrails framework. It generates hook scripts for AI agents (Claude Code, Cursor, Codex, OpenCode) that enforce security, quality, and workflow rules during AI coding sessions.

## Architecture

```
Layer 5: ANALYTICS (reports, drift detection)
Layer 4: LEARNING (convention extraction from codebases)
Layer 3: WORKFLOW (git flow, PR templates, commit conventions)
Layer 2: QUALITY (imports, naming, anti-patterns, file structure)
Layer 1: SECURITY (branch protection, secrets, destructive commands)
Layer 0: CORE ENGINE (hook runner, config parser, rule resolver)
```

## Key Directories

- `src/engine/` — Core hook execution: runner, resolver, context, scanner, tracker, edit-rule-factory
- `src/rules/{security,quality,workflow}/` — Built-in rules. Each rule exports a `Rule` object
- `src/config/` — Config loading, Zod validation, preset merging, pre-compilation
- `src/adapters/` — Output generators per agent (claude-code, cursor, codex, opencode, github-actions)
- `src/learn/` — Convention learning engine (analyzers, promoter, walker)
- `src/cli/commands/` — CLI commands (init, add, remove, generate, doctor, lint, learn, report, eject, upgrade)
- `src/presets/` — Ecosystem presets (nextjs-15, typescript-strict, react-19, tailwind, supabase, django, fastapi, laravel)
- `src/plugins/` — Plugin loader and validator
- `tests/` — Vitest tests mirroring src/ structure

## Development Commands

```bash
npm run build        # Build with tsup (dual ESM/CJS)
npm run dev          # Watch mode build
npm test             # Run tests
npm run test:coverage # Run tests with coverage
npm run lint         # ESLint
npm run type-check   # TypeScript strict type checking
npm run format       # Prettier
```

## Conventions

- **TypeScript strict mode** — no `any`, no unused vars (leading `_` allowed)
- **Dual ESM/CJS output** — import paths use `.js` extension (e.g., `from './types.js'`)
- **Rule pattern**: export a `Rule` object with `id`, `name`, `description`, `severity`, `events`, `match`, `check()`
- **Fail-open philosophy** — every `try/catch` exits 0. Internal errors never block developer work
- **Edit rule factory** — `createEditVariant()` auto-generates Edit variants that only flag *newly introduced* issues
- **Conventional commits** enforced by commitlint: `feat(scope): message`
- **Test files** mirror source structure: `src/rules/security/foo.ts` → `tests/rules/security/foo.test.ts`
- **Prettier**: semicolons, single quotes, trailing commas, 100 char width

## Critical Design Decisions

1. **Hook scripts are pre-compiled** to `.vguard/cache/resolved-config.json` for fast execution (<100ms target)
2. **Tracker** (`.vguard/data/rule-hits.jsonl`) is append-only JSONL with 10MB auto-rotation — this is the data layer Cloud will consume
3. **Config resolution**: defaults → presets → user rules. Severity can only be *downgraded*, never upgraded by presets
4. **Claude Code adapter** generates hooks and merges into `.claude/settings.json` — it does NOT overwrite existing settings

## Slash Commands

Use these project commands for common development tasks:

| Command | Purpose |
|---------|---------|
| `/project:add-rule` | Scaffold a new rule with file, test, and registration |
| `/project:add-preset` | Scaffold a new preset for a tech stack |
| `/project:run-tests` | Run test suite and analyze failures |
| `/project:build` | Build, type-check, lint, and verify dist output |
| `/project:release` | Guide through version bump, changelog, and release |
| `/project:adapter-check` | Verify all adapter outputs are correct |
| `/project:publish-changelog` | Publish changelog discussion to GitHub after release |

## Skills

Use these skills for scaffolding new components:

| Skill | Trigger | What It Creates |
|-------|---------|-----------------|
| `/new-rule` | "create a rule", "add rule" | Rule file + test + registration |
| `/new-preset` | "create a preset", "add preset" | Preset file + registration |
| `/new-adapter` | "add adapter", "support new agent" | Adapter file + type updates |

## Adding a New Rule

Use the `/new-rule` skill or follow manually:

1. Create `src/rules/{category}/{rule-name}.ts` exporting a `Rule` object
2. Register in `src/rules/{category}/index.ts`
3. Create `tests/rules/{category}/{rule-name}.test.ts`
4. Add to relevant presets in `src/presets/`

## Adapter System

Each adapter in `src/adapters/` generates agent-specific files:

| Adapter | Generated Files | Strategy |
|---------|----------------|----------|
| `claude-code` | `.vguard/hooks/*.js`, `.claude/settings.json`, `.claude/commands/vguard-*.md`, `.claude/rules/vguard-enforcement.md` | hooks: overwrite, settings: merge, commands: create-only, rules: overwrite |
| `cursor` | `.cursorrules`, `.cursor/rules/*.mdc` | overwrite |
| `codex` | `AGENTS.md`, `.codex/instructions.md` | overwrite / create-only |
| `opencode` | `.opencode/instructions.md` | overwrite |
| `github-actions` | `.github/workflows/vguard.yml` | create-only |

## Git Workflow

- **`master`** — production, squash merges from `dev` via PR only
- **`dev`** — integration branch, all work merges here first
- Branch from `dev`: `feature/<name>`, `fix/<name>`, `chore/<name>`

## Enforcement Rules

### Pre-Commit Hooks (`.husky/pre-commit`)

1. **Lint + Type-check** — always runs on every commit
2. **CHANGELOG.md required** — on `dev`, `master`, `main` branches, `CHANGELOG.md` must be staged
3. **Version bump required** — on `master`/`main` branches, `package.json` must be staged (version bump)

### CI Checks (`.github/workflows/ci.yml`)

- **`release-checks` job** — runs only on PRs targeting `master`:
  - Fails if `package.json` version matches the current `master` version (no bump)
  - Fails if `CHANGELOG.md` has no diff compared to `master`

### Publish Workflow (`.github/workflows/publish.yml`)

- Triggers on push to `master` (PR merge)
- **`preflight`** — checks if PR merge, version unpublished, tag missing
- **`validate`** — full CI (lint, format, type-check, test, build)
- **`publish`** — npm publish with OIDC provenance, git tag, GitHub Release
- **`changelog`** — creates a GitHub Discussion post in the Changelog category with version notes and commit list
