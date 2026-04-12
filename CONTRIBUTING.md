# Contributing to VGuard

## Development Setup

```bash
git clone https://github.com/Anthril/vibe-guard.git
cd vibe-guard
npm install
npm run build
npm test
```

## Branching Strategy

```
master          ← Production. Only receives squash merges from dev via PR.
  └── dev       ← Integration branch. All work merges here first.
       ├── feature/<name>   ← New features and enhancements
       ├── fix/<name>       ← Bug fixes and issue resolutions
       └── chore/<name>     ← Maintenance, refactoring, CI/CD, docs
```

1. **Start from `dev`**: Always branch off `dev` for new work.

   ```bash
   git checkout dev && git pull origin dev
   git checkout -b feature/my-feature
   ```

2. **Open a PR targeting `dev`**: Push your branch and create a pull request.

   ```bash
   git push -u origin feature/my-feature
   ```

3. **CI must pass**: Lint, type-check, tests, and build are required before merge.

4. **Releases**: Maintainers merge `dev` into `master` via PR, which triggers automated npm publishing.

## Project Structure

```
src/
  types.ts           # Core interfaces (Rule, HookContext, etc.)
  config/            # Configuration loading and validation
  engine/            # Rule execution engine
  rules/
    security/        # Security rules (branch-protection, etc.)
    quality/         # Quality rules (import-aliases, etc.)
    workflow/        # Workflow rules (commit conventions, etc.)
  presets/           # Tech stack presets
  adapters/          # Agent-specific adapters
  plugins/           # Plugin loader and validator
  utils/             # Shared utilities
  cli/               # CLI commands
```

## Adding a New Rule

1. Create the rule file in `src/rules/{category}/{rule-name}.ts`
2. Implement the `Rule` interface
3. Register it in `src/rules/{category}/index.ts` and `src/rules/index.ts`
4. Write tests in `tests/rules/{category}/{rule-name}.test.ts`
5. Submit a PR targeting `dev` with conventional commit: `feat(rules): add {category}/{rule-name}`

## Code Style

- TypeScript strict mode (no `any`)
- ESLint + Prettier (auto-formatted)
- Conventional commits (enforced by commitlint)

## Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```
