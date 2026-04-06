# AI Skills for VGuard

This directory contains AI-readable skill definitions that help AI coding assistants set up, configure, and troubleshoot [VGuard](https://github.com/solanticai/vibe-guard) — the open-source AI coding guardrails framework.

## How to Use

Point your AI assistant at the relevant skill file:

```
Read and follow: https://github.com/solanticai/vibe-guard/blob/master/ai-for-vibe-guard/skills/setup-vguard/SKILL.md
```

Or reference the local path if you have the repo cloned.

## Available Skills

| Skill | Description |
|-------|-------------|
| [setup-vguard](skills/setup-vguard/SKILL.md) | Install and configure VGuard in any project |
| [add-rules](skills/add-rules/SKILL.md) | Add or enable specific guardrail rules |
| [configure-presets](skills/configure-presets/SKILL.md) | Configure ecosystem presets for your framework |
| [cloud-connect](skills/cloud-connect/SKILL.md) | Connect to VGuard Cloud for analytics |
| [troubleshoot](skills/troubleshoot/SKILL.md) | Debug common VGuard issues |
| [custom-rules](skills/custom-rules/SKILL.md) | Write project-specific custom guardrail rules |

## What is VGuard?

VGuard enforces code quality guardrails when AI coding agents (Claude Code, Cursor, Codex, OpenCode) generate code. It provides:

- **30+ built-in rules** across 7 categories (security, quality, workflow, testing, maintainability, performance, reliability)
- **16 ecosystem presets** (Next.js, React, TypeScript, Supabase, Tailwind, Django, FastAPI, Express, Laravel, and more)
- **Runtime enforcement** for Claude Code (blocks/warns in real-time via hooks)
- **Advisory guidance** for Cursor, Codex, and OpenCode (generates rules files)
- **Cloud dashboard** at [vguard.dev](https://vguard.dev) for analytics, drift detection, and team insights

## Links

- [npm package](https://www.npmjs.com/package/@solanticai/vguard)
- [Documentation](https://vguard.dev/docs)
- [GitHub](https://github.com/solanticai/vibe-guard)
- [VGuard Cloud](https://vguard.dev)
