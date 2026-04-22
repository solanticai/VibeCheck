---
name: new-adapter
description: Scaffold a new VGuard adapter for an AI coding agent. Use when the user says "add adapter", "support a new agent", or wants to integrate VGuard with a new AI tool.
args: agent_name
---

# Create New VGuard Adapter: $ARGUMENTS

Generate a VGuard adapter that produces agent-specific configuration files.

## What This Skill Creates

1. **Adapter file** at `src/adapters/<agent-id>/adapter.ts`
2. **Registration** in the CLI commands and type definitions

## Required Information

Ask the user for these if not provided:
- **Agent ID**: kebab-case identifier (e.g., `windsurf`, `aider`)
- **Agent Name**: Human-readable (e.g., `Windsurf`, `Aider`)
- **Enforcement level**: `runtime` (can block operations) or `advisory` (guidance only)
- **Output files**: What files the adapter generates and where
- **Config format**: How the agent reads configuration (markdown, JSON, TOML, etc.)

## Implementation Steps

### 1. Create Adapter Directory and File

Use the template at `.claude/skills/new-adapter/templates/adapter.ts`.

Review existing adapters for reference:
- `claude-code/adapter.ts` — runtime enforcement with hook scripts (strategy: hooks overwrite, settings merge, commands create-only)
- `cursor/adapter.ts` — advisory with .cursorrules + .mdc files (strategy: overwrite)
- `codex/adapter.ts` — advisory with AGENTS.md (strategy: overwrite + create-only)
- `opencode/adapter.ts` — advisory with instructions.md (strategy: overwrite)
- `github-actions/adapter.ts` — CI enforcement with workflow YAML (strategy: create-only)
- `http-webhook/adapter.ts` — dispatcher for Cloud / Slack / custom endpoints (strategy: merge into existing dispatcher config; no file overwrite — the adapter emits a dispatcher registration rather than a static config)

Strategy reference for new adapters:
- **overwrite** — regenerate the whole file each run (cursor, github-actions for create-only files)
- **merge** — read existing file, update only VGuard-managed sections (claude-code settings, http-webhook dispatcher config)
- **create-only** — never touch an existing file; users edit freely after first run (codex AGENTS.md, github-actions workflow)

### 2. Update Type Definitions

In `src/types.ts`, add the new agent to `AgentType`:
```typescript
export type AgentType =
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'opencode'
  | 'github-actions'
  | 'http-webhook'
  | '<agent-id>';
```

### 3. Update Config Schema

In `src/config/schema.ts`, add the agent to the Zod enum.

### 4. Register in CLI

In `src/cli/commands/generate.ts` and `src/cli/commands/init.ts`, add the adapter import and generation call.

### 5. Create Tests

Create `tests/adapters/<agent-id>.test.ts` with tests for:
- Correct file generation
- Proper merge strategy
- All active rules included in output
- Correct formatting for the agent's config format

### 6. Verify

```bash
npm run type-check
npm test -- --reporter verbose tests/adapters/<agent-id>.test.ts
npm test
```
