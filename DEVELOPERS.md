# Developer Guide

Everything you need to build, test, and contribute to VGuard.

## Prerequisites

- **Node.js** >=20.0.0
- **npm** >=9
- **Git** with commit signing (optional but recommended)

## Setup

```bash
git clone https://github.com/anthril/vibe-guard.git
cd vibe-guard
npm install
npm run build
npm test
```

Husky installs automatically via the `prepare` script.

## Scripts

| Command                 | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `npm run build`         | Bundle with tsup + generate declarations + inject shebang |
| `npm run dev`           | Watch mode (tsup --watch)                                 |
| `npm test`              | Run tests once (vitest)                                   |
| `npm run test:watch`    | Watch mode tests                                          |
| `npm run test:coverage` | Tests with V8 coverage                                    |
| `npm run lint`          | ESLint                                                    |
| `npm run type-check`    | TypeScript `--noEmit` check                               |
| `npm run format`        | Prettier write                                            |
| `npm run format:check`  | Prettier check                                            |

## Project Structure

```
src/
├── index.ts                  # Public API exports
├── types.ts                  # Core interfaces (Rule, HookContext, RuleResult, etc.)
│
├── adapters/                 # Agent-specific output generators
│   ├── claude-code/          #   Hook scripts, commands, rules, settings merger
│   ├── cursor/               #   .cursorrules + .cursor/rules/*.mdc
│   ├── codex/                #   AGENTS.md + .codex/instructions.md
│   ├── opencode/             #   Config file generation
│   └── github-actions/       #   .github/workflows/vguard.yml
│
├── cli/                      # CLI entry point + commands
│   ├── commands/             #   16 commands (init, generate, lint, doctor, etc.)
│   └── formatters/           #   Output formats (text, json, github-actions)
│
├── config/                   # Config loading, validation, compilation
│   ├── discovery.ts          #   Find vguard.config.ts
│   ├── loader.ts             #   Load + resolve config
│   ├── schema.ts             #   Zod validation schema
│   ├── compile.ts            #   Compile to resolved JSON
│   ├── presets.ts            #   Preset registry
│   └── profiles.ts           #   Config profiles
│
├── engine/                   # Rule execution engine
│   ├── runner.ts             #   Main rule runner
│   ├── resolver.ts           #   Rule resolution from config
│   ├── registry.ts           #   Global rule registry
│   ├── context.ts            #   HookContext builder
│   ├── hook-entry.ts         #   Entry point for hook subprocess
│   ├── edit-rule-factory.ts  #   Factory for diff-aware edit rules
│   ├── scanner.ts            #   File scanner
│   ├── output.ts             #   Result formatting
│   └── tracker.ts            #   Execution tracking
│
├── rules/                    # Rule definitions
│   ├── security/             #   8 rules (branch-protection, secret-detection, etc.)
│   ├── quality/              #   13 rules (import-aliases, hallucination-guard, etc.)
│   └── workflow/             #   8 rules (commit-conventions, pr-reminder, etc.)
│
├── presets/                  # 14 ecosystem presets
│   ├── nextjs-15.ts, react-19.ts, typescript-strict.ts, supabase.ts
│   ├── tailwind.ts, django.ts, fastapi.ts, laravel.ts
│   ├── wordpress.ts, react-native.ts, astro.ts, sveltekit.ts
│   ├── python-strict.ts, go.ts
│   └── index.ts              #   Auto-registers all presets
│
├── cloud/                    # VGuard Cloud integration
├── eject/                    # Eject to standalone bundled config
├── learn/                    # Codebase learning/analysis system
├── plugins/                  # Plugin loader and validator
├── report/                   # Drift reports and markdown output
├── upgrade/                  # Version upgrade checker
└── utils/                    # Shared utilities (git, path, patterns, stdin)
```

## Build System

tsup bundles the project into two outputs:

1. **Library** — `dist/index.{js,cjs}` and `dist/hooks/runner.{js,cjs}` (ESM + CJS)
2. **CLI** — `dist/cli.{js,cjs}` with `#!/usr/bin/env node` shebang

TypeScript declarations are generated in a separate post-build step. Target: Node 20 (ES2022).

## Testing

Vitest handles all testing. Tests mirror the `src/` structure:

```
tests/
├── adapters/         # Adapter output tests
├── cli/              # CLI command tests
├── cloud/            # Cloud integration tests
├── config/           # Config loading/validation tests
├── eject/            # Eject feature tests
├── engine/           # Rule engine tests
├── integration/      # End-to-end pipeline tests
├── learn/            # Learning system tests
├── plugins/          # Plugin system tests
├── report/           # Reporting tests
├── rules/            # Rule-specific tests
├── utils/            # Utility tests
├── benchmarks/       # Performance benchmarks (excluded from CI)
└── fixtures/         # Sample projects and mock contexts
```

### Coverage Thresholds

| Metric     | Target |
| ---------- | -----: |
| Lines      |    80% |
| Branches   |    70% |
| Functions  |    75% |
| Statements |    80% |

### Writing Tests

- Place tests in `tests/{module}/{name}.test.ts` matching the `src/` path
- Use `vitest` globals (`describe`, `it`, `expect`, `vi`)
- Security rule tests use string fragments to avoid triggering content filters:
  ```typescript
  const cmd = (...parts: string[]): string => parts.join('');
  destructiveCommands.check(createContext(cmd('rm ', '-rf /')));
  ```
- Test fixtures live in `tests/fixtures/`

## Code Style

| Tool       | Config                  | Purpose                                                                             |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------- |
| ESLint 10  | `eslint.config.js`      | Linting (typescript-eslint, no `any`, unused vars)                                  |
| Prettier 3 | `.prettierrc`           | Formatting (single quotes, trailing commas, 100 char width)                         |
| commitlint | `commitlint.config.mjs` | Conventional commits (feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert) |
| Husky 9    | `.husky/`               | Pre-commit (lint + type-check), commit-msg (commitlint)                             |

### TypeScript

- Strict mode enabled, no `any` (enforced by eslint)
- ES2022 target, NodeNext module resolution
- Unused variables prefixed with `_` are allowed

## Git Hooks

### Pre-commit

Runs `npm run lint && npm run type-check`. On protected branches (`dev`, `master`):

- **dev/master**: Blocks commit if `CHANGELOG.md` is not staged
- **master only**: Also blocks if `package.json` is not staged (version bump required)

### Commit-msg

Validates conventional commit format via commitlint. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Architecture

### How Rules Execute

1. An AI agent triggers a hook event (`PreToolUse`, `PostToolUse`, `Stop`)
2. The hook subprocess reads the event payload from stdin
3. `engine/context.ts` builds a `HookContext` from the payload
4. `engine/resolver.ts` resolves which rules apply based on config
5. `engine/runner.ts` executes each rule's `check()` function
6. Results are collected: `pass`, `warn`, or `block`
7. `engine/output.ts` formats the response
8. Exit code signals the result: `0` = pass, `2` = block

### Edit Rule Factory

The `edit-rule-factory.ts` creates rules that only flag **newly introduced** problems by diffing before/after content. Pre-existing issues are ignored.

### Config Resolution

```
vguard.config.ts → loader → schema validation → preset expansion → rule resolution → compiled JSON
```

The compiled config is cached at `.vguard/cache/resolved-config.json` for fast hook execution.

## Adding a Rule

Use the scaffold skill or create manually:

1. Create `src/rules/{category}/{rule-name}.ts` implementing the `Rule` interface
2. Register in `src/rules/{category}/index.ts`
3. Add tests in `tests/rules/{category}/{rule-name}.test.ts`
4. Add to relevant presets if applicable

### Rule Interface

```typescript
interface Rule {
  id: string; // e.g. 'security/branch-protection'
  name: string; // Human-readable name
  description: string; // What it does
  severity: 'block' | 'warn' | 'info';
  events: HookEvent[]; // Which events trigger this rule
  match?: { tools?: string[] }; // Optional tool filter
  check: (context: HookContext) => RuleResult;
}
```

## Adding a Preset

1. Create `src/presets/{name}.ts` with rules array and default config
2. Register in `src/presets/index.ts`
3. Add tests verifying rule composition

## Adding an Adapter

1. Create `src/adapters/{name}/adapter.ts` implementing the `Adapter` interface
2. Wire into `src/cli/commands/generate.ts` and `src/cli/commands/init.ts`
3. Add tests in `tests/adapters/{name}.test.ts`

## CI/CD

### CI (every push/PR)

1. **release-checks** — PRs to master must bump version and update changelog
2. **lint** — ESLint + Prettier
3. **type-check** — TypeScript
4. **test** — Matrix: ubuntu/macos/windows × node 20/22
5. **build** — tsup bundle

### Publish (merge to master)

1. **preflight** — Detect PR merge, extract version, determine npm tag, check if already published
2. **validate** — Full CI suite
3. **publish** — npm publish via OIDC trusted publishing + git tag + GitHub release
4. **changelog** — Post release notes to GitHub Discussions

## Makefile

```bash
make contributors              # Fetch & merge contributors from all repos
make contributors.vibe-guard   # Fetch from a single repo
```

Outputs JSON to `.github/data/`.

## Useful Links

- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines
- [CHANGELOG.md](CHANGELOG.md) — Release history
- [SECURITY.md](SECURITY.md) — Security policy
- [vguard.dev/docs](https://vguard.dev/docs) — Full documentation
