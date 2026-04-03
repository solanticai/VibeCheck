Verify all VGuard adapters generate correct output.

## Steps

1. **Build the project first:**
   ```bash
   npm run build
   ```

2. **Run adapter-specific tests:**
   ```bash
   npm test -- --reporter verbose tests/adapters/
   ```

3. **Manual verification** — for each adapter, check that `generate()` produces valid output:

   **Claude Code adapter** (`src/adapters/claude-code/adapter.ts`):
   - Hook scripts in `.vguard/hooks/` (one per active event)
   - `.claude/settings.json` entries (merged, non-destructive)
   - `.claude/commands/vguard-*.md` (9 command files, create-only)
   - `.claude/rules/vguard-enforcement.md` (overwrite, dynamic from config)

   **Cursor adapter** (`src/adapters/cursor/adapter.ts`):
   - `.cursorrules` (top-level summary)
   - `.cursor/rules/*.mdc` (per-rule instruction files)

   **Codex adapter** (`src/adapters/codex/adapter.ts`):
   - `AGENTS.md` (rule documentation)
   - `.codex/instructions.md` (Codex-specific instructions)

   **OpenCode adapter** (`src/adapters/opencode/adapter.ts`):
   - `.opencode/instructions.md` (rule documentation)

   **GitHub Actions adapter** (`src/adapters/github-actions/adapter.ts`):
   - `.github/workflows/vguard.yml` (CI workflow)

4. **Verify merge strategies** work correctly:
   - `overwrite`: File is replaced
   - `merge`: Only VGuard sections updated, user content preserved
   - `create-only`: Existing files are not overwritten

5. Report any issues found with file paths and expected vs actual output.
