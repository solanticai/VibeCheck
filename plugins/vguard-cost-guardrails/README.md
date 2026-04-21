# @anthril/vguard-cost-guardrails

Reference VGuard plugin that layers per-tool cost budgets on top of the core
`workflow/cost-budget` rule.

## Install (when published)

```bash
npm i -D @anthril/vguard-cost-guardrails
```

## Configure

```typescript
// vguard.config.ts
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  presets: ['nextjs-15'],
  plugins: ['@anthril/vguard-cost-guardrails'],
  rules: {
    // Core session/day budgets (built-in rule):
    'workflow/cost-budget': {
      severity: 'block',
      usdPerDay: 10,
      tokensPerSession: 200_000,
    },
    // Per-tool budgets (plugin rule):
    'cost-guardrails/per-tool-budget': {
      severity: 'block',
      tokensPerToolPerSession: {
        WebFetch: 20_000,
        Read: 30_000,
        Bash: 5_000,
      },
    },
  },
});
```

## How it works

Reads `.vguard/data/cost-usage.jsonl` (populated by core's `recordUsage`) and tallies
per-tool token spend for the current session. Blocks when a tool exceeds its per-tool
limit even if the global session budget is not yet exhausted.

Designed for AI FinOps / token-budget governance (OWASP LLM10 + ASI08).
