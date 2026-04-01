# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-04-02

### Fixed

- **Fix CLI binary on Node 24**: Remove duplicate shebang from ESM output that caused `SyntaxError: Invalid or unexpected token` on Node 24's strict ESM parser. CLI bin now points to CJS output with single shebang.

## [1.0.1] - 2026-04-02

### Security

- **Fix command injection in upgrade checker**: Replace `execSync` template strings with `execFileSync` array arguments in `upgrade/checker.ts` — prevents shell metacharacter injection via plugin names
- **Fix command injection in upgrade apply**: Replace `execSync` with `execFileSync` in `cli/commands/upgrade.ts` and pin to exact resolved version instead of `@latest`
- **Fix shell injection in git utilities**: Replace `execSync` string concatenation with `execFileSync` array arguments in `utils/git.ts` — eliminates shell interpretation entirely
- **Fix shell injection in ejected hooks**: Generated self-contained scripts now use `execFileSync` with array arguments instead of string concatenation
- **Add npm package name validation**: Plugin names are validated against the npm naming spec (`/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/`) in config schema, plugin loader, and upgrade checker
- **Harden stdin parsing**: Stdin reads are now capped at 2 MB to prevent memory exhaustion from oversized payloads
- **Require explicit cloud sync opt-in**: Auto-sync on Stop events now requires `cloud.autoSync: true` in config — having `VIBECHECK_API_KEY` set alone no longer triggers telemetry
- **Restrict credential file permissions**: `~/.vibecheck/credentials.json` is now written with mode `0o600` and the directory with `0o700`
- **Add runtime hook event validation**: `executeHook()` validates the event string against known values before processing, preventing template injection
- **Validate file paths before git commands**: Paths from stdin tool input are checked for shell metacharacters before being passed to git context building

### Added

- New shared validation module (`utils/validation.ts`) with `isValidNpmPackageName`, `isValidFilePath`, and `isValidHookEvent` utilities
- `cloud` field on `ResolvedConfig` type — cloud settings are now preserved through config compilation and deserialization

## [1.0.0] - 2026-04-01

First stable release.

### Highlights

- **21 built-in rules**: 7 security, 11 quality, 7 workflow
- **14 presets**: nextjs-15, typescript-strict, react-19, supabase, tailwind, django, fastapi, laravel, wordpress, react-native, astro, sveltekit, python-strict, go
- **5 adapters**: Claude Code (runtime), Cursor, Codex, OpenCode, GitHub Actions
- **16 CLI commands**: init, add, remove, generate, doctor, lint, learn, report, eject, upgrade, fix, cloud login/logout/connect/status, sync
- **Rule Profiles**: strict, standard, relaxed, audit
- **Autofix API**: Machine-applicable fixes via `vibecheck fix`
- **Monorepo support**: Per-workspace config overrides
- **Config inheritance**: Global ~/.vibecheck/config.ts
- **Cloud sync**: Auto-sync rule hits to VibeCheck Cloud
- **Performance budget**: 100ms p95 target with instrumentation
- **Convention learning**: Import, naming, structure analyzers
- **80%+ test coverage** across 334 tests

## [1.0.0-rc.1] - 2026-04-01

### Added

- **Cloud auto-sync**: Stop hook triggers `vibecheck sync` automatically when `VIBECHECK_API_KEY` is set
- **Performance budget**: Hook execution timing recorded to `.vibecheck/data/perf.jsonl`, `vibecheck doctor` reports p95 vs 100ms budget
- **Eject enhancements**: `--adapter` and `--output` flags, auto-updates `.claude/settings.json`
- **Upgrade enhancements**: `--apply` flag, version diff display, major/minor/patch guidance

### Changed

- Coverage thresholds raised to 80% lines/statements, 75% functions, 70% branches
- Version bumped to 1.0.0-rc.1

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
