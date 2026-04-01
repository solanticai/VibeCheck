# VibeCheck

**AI coding guardrails that actually enforce.** Runtime quality controls for Claude Code, Cursor, Codex, and more.

---

## The Problem

AI coding tools are everywhere. **84% of developers** use them daily. But only **29% trust the output**, and **45% of AI-generated code contains security vulnerabilities.**

The current solutions? Monolithic prompt libraries with 136+ skills you'll never use. Methodology-locked frameworks that slow you down 3.7x. Or writing your own hooks from scratch every time.

**VibeCheck is different.** It's a composable, agent-agnostic guardrails framework that:

- **Blocks bad code at runtime** -- not just suggestions, actual enforcement
- **Works across AI tools** -- Claude Code, Cursor, Codex, OpenCode
- **Starts small, scales up** -- add one rule or a full preset
- **Only flags new problems** -- pre-existing issues aren't your fault today

## Quick Start

```bash
npm install -D @solanticai/vibecheck
npx vibecheck init
```

Answer 4 questions and you have working guardrails. The init wizard detects your framework, asks which AI tools you use, and generates everything.

## What It Does

### Runtime Enforcement (Claude Code)

VibeCheck generates hook scripts that run **before** your AI agent makes changes. Bad code gets blocked with a clear explanation and suggested fix.

```
BLOCKED by vibecheck [security/branch-protection]

Cannot write to files on branch 'main'.
Create a feature branch first: git checkout -b feat/your-change
```

### Advisory Guidance (Cursor, Codex, OpenCode)

For agents without hook support, VibeCheck generates configuration files that guide AI behavior.

| Agent           | Enforcement          | Mechanism                    |
| --------------- | -------------------- | ---------------------------- |
| **Claude Code** | **Runtime (blocks)** | Hook scripts with exit codes |
| Cursor          | Advisory             | `.cursorrules`               |
| Codex           | Advisory             | `AGENTS.md`                  |
| OpenCode        | Advisory             | Config file                  |

## Built-in Rules

### Security (enabled by default)

| Rule                            | What it prevents                                         |
| ------------------------------- | -------------------------------------------------------- |
| `security/branch-protection`    | Writing to `main`, `master`, or other protected branches |
| `security/destructive-commands` | `rm -rf ~/`, `git push --force`, `git reset --hard`      |
| `security/secret-detection`     | API keys, tokens, and passwords in committed code        |

### Quality (via presets)

| Rule                             | What it enforces                           |
| -------------------------------- | ------------------------------------------ |
| `quality/import-aliases`         | Use `@/` instead of deep relative imports  |
| `quality/no-use-client-in-pages` | No `"use client"` in Next.js pages/layouts |

## Presets

Presets bundle ecosystem-specific rules:

```typescript
import { defineConfig } from '@solanticai/vibecheck';

export default defineConfig({
  presets: ['nextjs-15', 'typescript-strict'],
  agents: ['claude-code'],
});
```

| Preset              | What it enforces                                        |
| ------------------- | ------------------------------------------------------- |
| `nextjs-15`         | App Router conventions, Server Components, path aliases |
| `typescript-strict` | Import aliases, no deep relative imports                |

## Configuration

```typescript
import { defineConfig } from '@solanticai/vibecheck';

export default defineConfig({
  presets: ['nextjs-15'],
  agents: ['claude-code'],
  rules: {
    'security/branch-protection': {
      protectedBranches: ['main', 'master', 'staging'],
    },
    'quality/import-aliases': false, // Disable a rule
  },
});
```

## CLI

| Command                           | Description                     |
| --------------------------------- | ------------------------------- |
| `vibecheck init`                  | Interactive setup wizard        |
| `vibecheck add <rule\|preset>`    | Add a rule or preset            |
| `vibecheck remove <rule\|preset>` | Remove a rule or preset         |
| `vibecheck generate`              | Regenerate hook scripts         |
| `vibecheck doctor`                | Validate config and hook health |

## How It Works

```
Developer prompt
      |
      v
  AI Agent (Claude Code / Cursor / Codex)
      |
      v
  VibeCheck hooks  <--  vibecheck.config.ts
      |                     |
      +-- PASS --------->  Change applied
      |
      +-- BLOCK -------->  Change rejected
                            with explanation + fix
```

For Claude Code, hooks execute as subprocesses before each tool use. They read the proposed change from stdin, evaluate it against your rules, and either allow (exit 0) or block (exit 2) the operation.

### The Edit Rule Factory

VibeCheck's key innovation: **Edit rules only flag newly introduced problems.** If a pattern existed before the edit, it's pre-existing and won't be flagged. This allows incremental improvement without forcing you to fix every legacy issue first.

## Creating Custom Rules

```typescript
import type { Rule } from '@solanticai/vibecheck';

export const noConsoleLog: Rule = {
  id: 'custom/no-console-log',
  name: 'No console.log',
  description: 'Prevents console.log in production code',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context) => {
    const content = String(context.toolInput.content || '');
    if (/console\.log\(/.test(content)) {
      return {
        status: 'warn',
        ruleId: 'custom/no-console-log',
        message: 'console.log detected. Use a proper logger instead.',
        fix: "Replace with your project's logger.",
      };
    }
    return { status: 'pass', ruleId: 'custom/no-console-log' };
  },
};
```

## Contributing

We welcome contributions! Adding a rule takes ~30 minutes. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache 2.0](LICENSE)
