# Getting Started

## Installation

```bash
npm install -D vibecheck
```

## Quick Start

```bash
npx vibecheck init
```

The init wizard will:
1. Detect your framework (Next.js, React, etc.)
2. Ask which AI agents you use
3. Ask which presets to enable
4. Configure protected branches

## What Gets Generated

After running `init`, VibeCheck creates:

- `vibecheck.config.ts` — your configuration file
- `.claude/settings.json` — Claude Code hook entries (merged with existing)
- `.vibecheck/hooks/` — hook scripts that enforce your rules
- `.vibecheck/cache/` — pre-compiled config for fast hook execution

## Verify Setup

```bash
npx vibecheck doctor
```

This checks:
- Config file exists and is valid
- Hook scripts are generated
- Rules are properly configured
- Node modules are available

## Next Steps

- [Configuration](./configuration.md) — customize rules and presets
- [Rules Reference](./rules/) — see all built-in rules
- [Presets](./presets.md) — ecosystem-specific rule bundles
- [Creating Custom Rules](./guides/rule-authoring.md) — extend VibeCheck
