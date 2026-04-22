List every rule active in the current project, grouped by category, with severity and events.

## Steps

1. **Resolve the current config:**
   ```bash
   npx vguard rules list --format json
   ```

2. **If no config exists**, fall back to reading the built-in registry:
   ```bash
   npx vguard rules list --all --format json
   ```

3. **Group by category** — for each of: `security`, `quality`, `workflow`, `maintainability`, `testing`, `performance`, `reliability`, `documentation`, print a section with:
   - Rule id
   - Severity (`block` / `warn` / `info` / `off`)
   - Events (`PreToolUse`, `PostToolUse`, `Stop`, `git:pre-commit`, `git:commit-msg`)
   - One-line description

4. **Highlight anything surprising:**
   - Rules with severity downgraded from their default (usually by a preset or user config)
   - Rules with events restricted to a single file pattern
   - Plugin-provided rules (id contains `/` prefix other than a category name)

5. **Suggest next commands:**
   - `vguard rules enable <id>` — turn on a disabled rule
   - `vguard rules disable <id>` — silence a noisy rule
   - `vguard presets list` — see bundled rule sets that might be better than one-off enables

Report the list as markdown tables, one per category, to make scanning easy.
