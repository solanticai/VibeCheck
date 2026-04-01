# CLI Reference

## Commands

### `vibecheck init`

Interactive setup wizard. Detects your framework, asks which agents and presets to use, generates config and hooks.

### `vibecheck add <id>`

Add a rule or preset.

```bash
vibecheck add security/branch-protection
vibecheck add preset:react-19
```

### `vibecheck remove <id>`

Remove or disable a rule or preset.

```bash
vibecheck remove quality/naming-conventions
vibecheck remove preset:tailwind
```

### `vibecheck generate`

Regenerate all adapter output (hook scripts, .cursorrules, etc.) from current config. Run this after changing `vibecheck.config.ts`.

### `vibecheck doctor`

Validate config and hook health. Reports issues with config, missing hooks, broken rules.

### `vibecheck lint`

Run all rules in static analysis mode. Scans project files and reports violations.

```bash
vibecheck lint                    # Text output
vibecheck lint --format json      # JSON output
vibecheck lint --format github-actions  # GH annotations
```

Exits with code 1 if blocking violations are found (CI-friendly).

### `vibecheck learn`

Scan codebase for conventions. Discovers import patterns, naming conventions, directory structure, and suggests rules.

### `vibecheck report`

Generate quality dashboard from rule hit data. Outputs markdown report to `.vibecheck/reports/quality-report.md`.

### `vibecheck eject`

Export standalone hook scripts that work without vibecheck installed. Use this to remove the vibecheck dependency while keeping enforcement.

### `vibecheck upgrade`

Check for and apply updates.

```bash
vibecheck upgrade --check   # Check only
vibecheck upgrade           # Apply updates
```
