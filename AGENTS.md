# VGuard — AI Agent Setup Instructions

Copy the relevant section below and provide it to your AI coding assistant (Claude Code, Codex, Cursor, etc.) as instructions for setting up VGuard in your project.

---

## For Claude Code

```
I want you to set up VGuard, an AI coding guardrails framework, in this project.

1. Install the package:
   npm install -D @anthril/vguard

2. Run the interactive setup:
   npx vguard init

   When prompted:
   - Select presets that match the project's tech stack (e.g., nextjs-15, typescript-strict, react-19, tailwind, supabase)
   - Select "Claude Code" as the AI agent
   - Set protected branches to "main, master"

3. Verify the setup:
   npx vguard doctor

   All checks should pass. If any fail, fix the issues it reports.

4. (Optional) Connect to VGuard Cloud for analytics:
   npx vguard cloud login
   npx vguard cloud connect
   npx vguard generate

5. Run a lint scan to see current issues:
   npx vguard lint

After setup, VGuard will automatically enforce rules via hooks in .claude/settings.json.
The hooks fire on PreToolUse (before Edit/Write/Bash), PostToolUse (after), and Stop (session end).
If a rule blocks, the tool execution is prevented. Warnings are logged but don't block.

Key commands:
- npx vguard lint          — scan for issues
- npx vguard learn         — discover codebase conventions
- npx vguard report        — generate quality dashboard
- npx vguard doctor        — check config health
- npx vguard generate      — regenerate hooks after config changes
```

---

## For Codex CLI

```
I want you to set up VGuard, an AI coding guardrails framework, in this project.

1. Install: npm install -D @anthril/vguard
2. Initialize: npx vguard init
   - Pick presets matching the project stack
   - Select "Codex" as the AI agent
   - Set protected branches to "main, master"
3. Verify: npx vguard doctor
4. Scan: npx vguard lint

VGuard generates an AGENTS.md file that Codex reads for advisory rules.
The rules are not runtime-enforced for Codex (advisory mode only).

After setup, run `npx vguard generate` whenever you change vguard.config.ts.
```

---

## For Cursor

```
I want you to set up VGuard, an AI coding guardrails framework, in this project.

1. Install: npm install -D @anthril/vguard
2. Initialize: npx vguard init
   - Pick presets matching the project stack
   - Select "Cursor" as the AI agent
   - Set protected branches to "main, master"
3. Verify: npx vguard doctor
4. Scan: npx vguard lint

VGuard generates a .cursorrules file that Cursor reads for advisory rules.
The rules guide Cursor's suggestions but are not runtime-enforced.

After setup, run `npx vguard generate` whenever you change vguard.config.ts.
```

---

## For OpenCode

```
I want you to set up VGuard, an AI coding guardrails framework, in this project.

1. Install: npm install -D @anthril/vguard
2. Initialize: npx vguard init
   - Pick presets matching the project stack
   - Select "OpenCode" as the AI agent
   - Set protected branches to "main, master"
3. Verify: npx vguard doctor
4. Scan: npx vguard lint

VGuard generates configuration in the .opencode/ directory.
After setup, run `npx vguard generate` whenever you change vguard.config.ts.
```

---

## For GitHub Actions (CI)

```
I want you to set up VGuard as a CI quality gate in this project's GitHub Actions workflow.

1. Install: npm install -D @anthril/vguard
2. Initialize: npx vguard init
   - Pick presets matching the project stack
   - Select "Claude Code" (or any agent — the CI adapter is always generated)
   - Set protected branches to "main, master"
3. Generate the workflow: npx vguard generate

This creates .github/workflows/vguard.yml which runs `vguard lint` on every PR.
The lint command exits with code 1 if blocking issues are found, failing the check.

To customize the CI output format:
- npx vguard lint --format github-actions   (annotates PR files)
- npx vguard lint --format json             (machine-readable)
- npx vguard lint --format text             (human-readable, default)
```

---

## Available Presets

| Preset              | Stack                      |
| ------------------- | -------------------------- |
| `nextjs-15`         | Next.js 15 App Router      |
| `react-19`          | React 19 patterns          |
| `typescript-strict` | Strict TypeScript          |
| `tailwind`          | Tailwind CSS utility-first |
| `supabase`          | Supabase best practices    |
| `astro`             | Astro framework            |
| `sveltekit`         | SvelteKit                  |
| `django`            | Django/Python              |
| `fastapi`           | FastAPI/Python             |
| `laravel`           | Laravel/PHP                |
| `python-strict`     | Python PEP 8               |
| `go`                | Go conventions             |

---

## Configuration Reference

After `vguard init`, your `vguard.config.ts` looks like:

```typescript
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  presets: ['nextjs-15', 'typescript-strict'],
  agents: ['claude-code'],
  rules: {
    'security/branch-protection': {
      protectedBranches: ['main', 'master'],
    },
  },
  cloud: {
    enabled: true,
    projectId: 'your-project-id',
    autoSync: true,
  },
});
```

See https://github.com/Anthril/vibe-guard for full documentation.
