# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Prettier formatting applied to 6 new rule and test files

## [1.3.0] - 2026-04-04

### Added

- 10 new built-in rules (25 → 35 total):
  - `security/unsafe-eval` — blocks eval(), new Function(), string setTimeout
  - `security/no-hardcoded-urls` — warns about hardcoded localhost and API URLs
  - `security/xss-prevention` — warns about dangerouslySetInnerHTML, innerHTML, v-html
  - `security/sql-injection` — blocks string-interpolated SQL queries
  - `quality/no-any-type` — warns about `any` type usage in TypeScript
  - `quality/error-handling` — warns about empty catch blocks
  - `quality/a11y-jsx` — accessibility checks for JSX (missing alt, onClick on divs)
  - `quality/magic-numbers` — flags numeric literals that should be named constants
  - `workflow/branch-naming` — enforces branch naming conventions (feature/, fix/, chore/)
  - `workflow/lockfile-consistency` — reminds to update lockfile after dependency changes
- 4 new presets (14 → 18 total): `vue`, `remix`, `prisma`, `express`
- `/release` skill for automated release lifecycle (version bump, changelog, PR, CI, discussion)
- Cloud streaming module for real-time rule hit telemetry

### Changed

- Updated 7 existing presets with new security and quality rules:
  - `nextjs-15`: added unsafe-eval, no-hardcoded-urls, error-handling, a11y-jsx
  - `typescript-strict`: added no-any-type, error-handling, unsafe-eval
  - `react-19`: added a11y-jsx, xss-prevention
  - `supabase`: added sql-injection
  - `django`: added xss-prevention, sql-injection
  - `fastapi`: added sql-injection
  - `laravel`: added xss-prevention, sql-injection
- Publish workflow: removed automated changelog discussion job (moved to `/release` skill)
- Cloud init flow updated for improved authentication handling

### Removed

- `/project:release` command (replaced by `/release` skill)
- `/project:publish-changelog` command (replaced by `/release` skill)
- Automated changelog discussion job from publish workflow

## [1.1.2] - 2026-04-03

### Fixed

- Publish workflow: add NODE_AUTH_TOKEN env for npm OIDC authentication

## [1.1.1] - 2026-04-03

### Changed

- CI workflow triggers on pull_request only (removed redundant push triggers)
- Test matrix: full 3 OS x 2 Node for PRs to master, Ubuntu + Node 22 only for PRs to dev
- Merged lint, format, and type-check into a single `quality` job
- Removed redundant `validate` job from publish workflow (CI already gates the PR)

### Fixed

- Prettier formatting applied to 25 files (tests, docs, fixtures)
- CI release-checks job now passes (instead of skipping) on push events

## [1.1.0] - 2026-04-03

### Added

- DEVELOPERS.md with full developer guide (setup, architecture, testing, extension guides)
- Makefile rewritten for VGuard contributor sync across vibe-guard and vibe-guard-cloud repos

### Fixed

- Lint errors in test files: removed unused imports and variables across 5 test files
- Replaced `require()` with dynamic `import()` in walker test to satisfy ESLint no-require-imports rule

## [1.0.0] - 2026-04-02

First stable release.

### Highlights

- **21 built-in rules**: 7 security, 11 quality, 7 workflow
- **14 presets**: nextjs-15, typescript-strict, react-19, supabase, tailwind, django, fastapi, laravel, wordpress, react-native, astro, sveltekit, python-strict, go
- **5 adapters**: Claude Code (runtime), Cursor, Codex, OpenCode, GitHub Actions
- **16 CLI commands**: init, add, remove, generate, doctor, lint, learn, report, eject, upgrade, fix, cloud login/logout/connect/status, sync

### Added

- Core rule engine with async-capable `check()` and `createEditVariant()` factory
- Config system with TypeScript support (via jiti), preset merging, pre-compilation
- Rule Profiles: `strict`, `standard`, `relaxed`, `audit` for bulk severity configuration
- Autofix API: Machine-applicable fixes via `vibecheck fix`
- Monorepo support with per-workspace config overrides
- Config inheritance via global `~/.vibecheck/config.ts`
- Convention learning engine with import, naming, and structure analyzers
- Quality dashboard with rule hit tracking and markdown reports
- Plugin API for third-party rules and presets
- Eject command for standalone hook export (removes VGuard dependency)
- Upgrade command with npm registry check and semver comparison
- Cloud sync: credentials management, API client, batch upload to VGuard Cloud
- Performance budget: 100ms p95 target with instrumentation and auto-downgrade

### Security

- Shell injection prevention: all subprocess calls use `execFileSync` with array arguments
- npm package name validation on plugin names and config
- Stdin parsing capped at 2 MB to prevent memory exhaustion
- Credential file permissions restricted to `0o600`
- Runtime hook event validation against known values
- File path validation before git commands
- Explicit opt-in required for cloud auto-sync
