# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0-beta.0] - 2026-04-01

### Added

- **New rule**: `security/rls-required` — warns when SQL migrations create tables without RLS
- **New rule**: `quality/dead-exports` — flags exported symbols not imported anywhere nearby
- **New rule**: `workflow/changelog-reminder` — reminds to update CHANGELOG.md after significant changes
- **New rule**: `workflow/format-on-save` — detects formatter (Prettier, Biome, Black, gofmt, rustfmt) and suggests running it
- **Autofix API**: `RuleResult.autofix` field for machine-applicable fixes, `vibecheck fix` command
- **Monorepo support**: `monorepo.packages` and `monorepo.overrides` config for per-workspace rules
- **Config inheritance**: Global config at `~/.vibecheck/config.ts` merges with project config
- **4 new presets**: `astro`, `sveltekit`, `python-strict`, `go` (14 total)

### Changed

- Rule count increased from 17 to 21 (7 security, 11 quality, 7 workflow)
- Preset count increased from 10 to 14

## [0.3.0-beta.0] - 2026-04-01

### Added

- **Rule Profiles**: `strict`, `standard`, `relaxed`, `audit` — bulk severity presets for different contexts
- **New rule**: `security/env-exposure` — blocks client-side code accessing .env files or logging process.env
- **New rule**: `quality/max-file-length` — warns when files exceed configurable line count (default: 400)
- **New rule**: `quality/no-console-log` — flags console.log in production source files (allows in tests/scripts)
- **New rule**: `workflow/todo-tracker` — counts TODO/FIXME/HACK comments and reports increases
- **Cloud CLI**: `vibecheck cloud login/logout/connect/status` commands for Cloud integration
- **Sync command**: `vibecheck sync` uploads rule-hits data to VibeCheck Cloud
- **Cloud module**: credentials management, API client, sync cursor tracking with batch uploads
- **Cloud config**: `cloud.enabled`, `cloud.projectId`, `cloud.autoSync`, `cloud.excludePaths` settings

### Changed

- Rule count increased from 13 to 17 (6 security, 10 quality, 5 workflow)
- Updated presets: nextjs-15, typescript-strict, supabase now include new rules
- Config schema extended with `profile` and `cloud` fields

## [0.2.0] - 2026-04-01

### Added

- Core rule engine with async-capable `check()` and `createEditVariant()` factory
- Config system with TypeScript support (via jiti), preset merging, pre-compilation
- 13 built-in rules: 5 security, 8 quality, 4 workflow
- 8 presets: nextjs-15, typescript-strict, react-19, supabase, tailwind, django, fastapi, laravel
- 5 adapters: Claude Code (runtime), Cursor (advisory), Codex (advisory), OpenCode (advisory), GitHub Actions
- 10 CLI commands: init, add, remove, generate, doctor, lint, learn, report, eject, upgrade
- Convention learning engine with import, naming, and structure analyzers
- Quality dashboard with rule hit tracking and markdown reports
- Plugin API for third-party rules and presets
- Eject command for standalone hook export
- Semver-aware version comparison for upgrade checker
- Eject module entry point for proper public API
- `.claude/CLAUDE.md` for dogfooding VibeCheck on itself

### Fixed

- Upgrade checker now uses semver comparison instead of string equality
- Eject module missing `index.ts` entry point

### Changed

- Test coverage thresholds raised to 70% (lines, functions, statements) and 65% (branches)
