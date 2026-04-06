---
name: cloud-connect
description: Connect a VGuard project to VGuard Cloud for analytics and monitoring. Use when the user says "connect to cloud", "enable cloud sync", "set up vguard cloud", or wants to use the VGuard Cloud dashboard.
args: api_key
---

# Connect to VGuard Cloud

Set up the connection between a local VGuard project and the VGuard Cloud dashboard at [vguard.dev](https://vguard.dev) for analytics, drift detection, and team insights.

## Prerequisites

- VGuard is installed and configured (`vguard.config.ts` exists)
- A VGuard Cloud account at [vguard.dev](https://vguard.dev)
- A project created in the Cloud dashboard with an API key

## Step 1: Check VGuard Installation

Verify `vguard.config.ts` exists in the project root. If not, run `npx vguard init` first.

## Step 2: Connect to Cloud

```bash
npx vguard cloud connect <your-api-key>
```

This stores credentials securely in `~/.vguard/credentials.json` (mode 0600).

If the API key is not provided as an argument, you can also set it via environment variable:
```bash
export VGUARD_API_KEY=vc_your_api_key_here
```

## Step 3: Enable Cloud in Config

Edit `vguard.config.ts` to enable cloud sync:

```typescript
import { defineConfig } from '@solanticai/vguard';

export default defineConfig({
  presets: ['nextjs-15'],
  agents: ['claude-code'],
  cloud: {
    enabled: true,
    // Auto-sync sends rule hits to the cloud in real-time.
    // Set to false for manual sync only (via `npx vguard sync`).
    autoSync: true,
  },
});
```

### Cloud Config Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable cloud connectivity |
| `autoSync` | `true` | Auto-sync rule hits in real-time (when enabled) |
| `excludePaths` | `[]` | Glob patterns for file paths to exclude from sync |
| `streaming.batchSize` | `10` | Events buffered before flushing |
| `streaming.flushIntervalMs` | `5000` | Max time between flushes (ms) |

## Step 4: Regenerate Hooks

```bash
npx vguard generate
```

## Step 5: Send Initial Sync

```bash
npx vguard sync
```

This uploads all existing rule hits from `.vguard/data/rule-hits.jsonl` to the cloud.

## Step 6: Verify Connection

```bash
npx vguard cloud status
```

This shows: connection status, project name, last sync timestamp, and credentials location.

You can also check the Cloud dashboard to see your project's data.

## Troubleshooting

- **"No API key found"**: Run `npx vguard cloud connect <key>` or set `VGUARD_API_KEY` env var
- **"Sync failed"**: Check internet connection and verify the API key is valid
- **Data not appearing**: Wait up to 30 seconds for real-time sync, or run `npx vguard sync` manually
- **Privacy concerns**: Add sensitive file paths to `cloud.excludePaths` or `.vguardignore`
