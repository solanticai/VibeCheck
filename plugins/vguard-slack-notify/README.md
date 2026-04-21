# @anthril/vguard-slack-notify

Reference VGuard plugin that forwards rule-block events to a Slack Incoming Webhook.

## Install (when published)

```bash
npm i -D @anthril/vguard-slack-notify
```

## Configure

```typescript
// vguard.config.ts
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  presets: ['nextjs-15'],
  plugins: ['@anthril/vguard-slack-notify'],
  rules: {
    'slack-notify/block-events': {
      severity: 'info',
      webhookUrl: process.env.SLACK_VGUARD_WEBHOOK,
      minSeverity: 'block',
      channel: '#vguard-alerts',
      includeFilePath: true,
      rateLimitMs: 60_000,
    },
  },
});
```

## How it works

The plugin registers one PostToolUse rule (`slack-notify/block-events`) that inspects
`.vguard/data/rule-hits.jsonl` for block-severity hits since the last notification and
posts a summary to the configured Slack webhook. Rate-limited to avoid alert storms.

On network failure the plugin fails-open — notification delivery must never block the
user's tool call.
