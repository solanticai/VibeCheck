# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
