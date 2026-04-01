# Plugin Authoring Guide

Create a VibeCheck plugin to share rules and presets with the community.

## Plugin Structure

A plugin is an npm package that exports a `VibeCheckPlugin` object:

```typescript
import type { VibeCheckPlugin } from 'vibecheck';

const plugin: VibeCheckPlugin = {
  name: 'vibecheck-plugin-my-rules',
  version: '1.0.0',
  rules: [...],     // Custom rules
  presets: [...],    // Custom presets
};

export default plugin;
```

## Naming Convention

- Package name: `vibecheck-plugin-<name>`
- Rule IDs: `<plugin-name>/<rule-name>` (e.g., `my-rules/no-barrel-imports`)
- Preset IDs: `<plugin-name>-<preset>` (e.g., `my-rules-strict`)

## Validation

VibeCheck validates plugins before loading:

- Rule IDs must follow `category/name` format
- Rule IDs must not conflict with built-in rules
- Preset IDs must not conflict with built-in presets
- Rules must have a `check` function
- Rules must specify at least one event

## Testing Your Plugin

```typescript
import { validatePlugin } from 'vibecheck';
import myPlugin from './index.js';

const result = validatePlugin(myPlugin, 'vibecheck-plugin-my-rules');
console.log(result.valid);    // true
console.log(result.errors);   // []
console.log(result.warnings); // []
```

## Publishing

1. Build your plugin with TypeScript
2. Test with `vibecheck doctor` in a consuming project
3. Publish to npm: `npm publish`
4. Users install: `npm install vibecheck-plugin-my-rules`
5. Users configure: `plugins: ['vibecheck-plugin-my-rules']`
