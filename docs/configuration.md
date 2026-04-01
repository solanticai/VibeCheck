# Configuration

VibeCheck is configured via `vibecheck.config.ts` (or `.vibecheckrc.json`).

## Config File

```typescript
import { defineConfig } from 'vibecheck';

export default defineConfig({
  // Presets bundle ecosystem-specific rules
  presets: ['nextjs-15', 'tailwind', 'supabase'],

  // AI agents to generate adapters for
  agents: ['claude-code', 'cursor'],

  // Rule configurations
  rules: {
    // Override defaults
    'security/branch-protection': {
      protectedBranches: ['main', 'master', 'staging'],
    },

    // Disable a rule
    'quality/naming-conventions': false,

    // Change severity (block -> warn)
    'quality/anti-patterns': {
      severity: 'warn',
    },
  },

  // Plugin packages
  plugins: ['vibecheck-plugin-example'],
});
```

## Config Resolution Order

1. **Rule defaults** (lowest priority)
2. **Presets** (applied in declaration order — last preset wins)
3. **User config** (highest priority — always wins)

## Supported Formats

| Format | File | Priority |
|--------|------|----------|
| TypeScript | `vibecheck.config.ts` | 1 (highest) |
| JavaScript | `vibecheck.config.js` | 2 |
| ESM | `vibecheck.config.mjs` | 3 |
| JSON | `.vibecheckrc.json` | 4 |
| package.json | `"vibecheck"` field | 5 (lowest) |

## Options

### `presets`

Array of preset IDs to apply. See [Presets](./presets.md).

### `agents`

Array of AI agent adapters to generate output for.

| Agent | Type | Output |
|-------|------|--------|
| `claude-code` | Runtime | `.claude/settings.json` + hook scripts |
| `cursor` | Advisory | `.cursorrules` + `.cursor/rules/` |
| `codex` | Advisory | `AGENTS.md` |
| `opencode` | Advisory | `.opencode/instructions.md` |

### `rules`

Per-rule configuration. Set to `false` to disable, `true` to enable with defaults, or an object for custom options.

### `plugins`

Array of npm package names that export `VibeCheckPlugin`.

### `learn`

Convention learning settings for `vibecheck learn`.

```typescript
learn: {
  enabled: true,
  scanPaths: ['src/'],
  ignorePaths: ['node_modules/', '.next/'],
}
```
