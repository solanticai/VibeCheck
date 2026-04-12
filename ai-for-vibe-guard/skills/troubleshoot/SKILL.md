---
name: troubleshoot
description: Debug common VGuard issues. Use when the user reports VGuard problems, "vguard not working", "hooks not running", "sync failing", or any VGuard errors.
args: error_description
---

# Troubleshoot VGuard

A diagnostic checklist for resolving common VGuard issues.

## Step 1: Run Built-in Diagnostics

```bash
npx vguard doctor
```

This checks: config validity, hook installation, Node.js version, package integrity, and cloud connectivity.

## Step 2: Check Configuration

1. Verify `vguard.config.ts` exists in the project root
2. Read it and check for syntax errors or invalid rule/preset names
3. Run `npx vguard lint` to validate the config

### Common Config Issues

- **Missing presets**: Ensure preset names match exactly (e.g., `nextjs-15`, not `nextjs`)
- **Invalid rule IDs**: Rules use `<category>/<rule-name>` format (e.g., `security/secrets-in-code`)
- **Wrong severity**: Must be `'block'`, `'warn'`, or `'info'`

## Step 3: Check Hook Installation

For **Claude Code** (runtime enforcement):

- Check `.claude/settings.json` for hook entries under `hooks.PreToolUse`, `hooks.PostToolUse`, etc.
- If missing, run `npx vguard generate`

For **Cursor** (advisory):

- Check for `.cursorrules` or `.cursor/rules/` directory
- If missing, run `npx vguard generate`

For **Codex** (advisory):

- Check for `AGENTS.md` in the project root
- If missing, run `npx vguard generate`

## Step 4: Check Node.js Version

```bash
node --version
```

VGuard requires Node.js >= 20.0.0. If your version is older, upgrade Node.js.

## Step 5: Check Compiled Config

VGuard compiles configuration for performance. If rules seem stale:

```bash
npx vguard generate --force
```

This regenerates the compiled config and all hook files.

## Step 6: Debug Cloud Sync Issues

```bash
npx vguard cloud status
```

Common cloud issues:

| Issue                           | Fix                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| "No API key found"              | Run `npx vguard cloud connect <key>`                                                 |
| "Sync failed (401)"             | API key is invalid or revoked — get a new one from the dashboard                     |
| "Sync failed (429)"             | Rate limited — wait a moment and retry                                               |
| Data not appearing in dashboard | Check `.vguard/data/rule-hits.jsonl` has entries, then run `npx vguard sync --force` |
| Stale data                      | Check `.vguard/data/sync-cursor.json` — delete it to force a full re-sync            |

## Step 7: Debug Rule Execution

```bash
npx vguard rules          # List all active rules and their severity
npx vguard rules --verbose  # Show which preset enabled each rule
```

If a rule isn't triggering:

- Check the rule's `events` match the hook event (PreToolUse, PostToolUse, Stop)
- Check the rule's `tools` match the tool being used (Edit, Write, Bash, etc.)
- Check file patterns if the rule uses glob matching

## Step 8: Nuclear Reset

If nothing else works, reset VGuard completely:

```bash
npx vguard init --force   # Regenerate config from scratch
npx vguard generate       # Regenerate all hook files
```

**Warning**: This overwrites your `vguard.config.ts`. Back it up first if you have custom rules.

## Common Error Messages

| Error                                  | Cause                      | Fix                                            |
| -------------------------------------- | -------------------------- | ---------------------------------------------- |
| `Cannot find module '@anthril/vguard'` | Package not installed      | Run `npm install -D @anthril/vguard`           |
| `Config file not found`                | Missing `vguard.config.ts` | Run `npx vguard init`                          |
| `Hook script failed`                   | Compiled config corrupted  | Run `npx vguard generate --force`              |
| `Permission denied` on credentials     | File permissions issue     | Check `~/.vguard/credentials.json` permissions |
