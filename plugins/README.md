# VGuard Reference Plugins

This directory contains reference plugin implementations that demonstrate the VGuard plugin contract.

They import from `../../src/types.js` during development. When published as standalone npm packages, they would import from `@anthril/vguard` and live in their own repositories.

| Plugin                                              | Purpose                                                                 | Status    |
| --------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| [vguard-slack-notify](./vguard-slack-notify/)       | Emit Slack webhook notifications for rule-block events.                 | Reference |
| [vguard-cost-guardrails](./vguard-cost-guardrails/) | Per-tool cost budgeting on top of the core `workflow/cost-budget` rule. | Reference |

## Plugin Contract

A VGuard plugin exports an object matching the `VGuardPlugin` type:

```typescript
import type { VGuardPlugin } from '@anthril/vguard';

export const myPlugin: VGuardPlugin = {
  name: '@anthril/vguard-my-plugin',
  version: '0.1.0',
  rules: [
    /* Rule[] */
  ],
  presets: [
    /* Preset[] */
  ],
};

export default myPlugin;
```

Plugins are registered via `plugins: ['@anthril/vguard-my-plugin']` in `vguard.config.ts`.
The loader is in [../src/plugins/loader.ts](../src/plugins/loader.ts).
