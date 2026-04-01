# Rule Authoring Guide

Create a custom VibeCheck rule in 30 minutes.

## Rule Structure

Every rule implements the `Rule` interface:

```typescript
import type { Rule } from 'vibecheck';

export const myRule: Rule = {
  id: 'custom/my-rule',          // category/name format
  name: 'My Rule',               // Human-readable
  description: 'What it checks', // Why it exists
  severity: 'warn',              // 'block' | 'warn' | 'info'
  events: ['PreToolUse'],        // When to run
  match: { tools: ['Write'] },   // Which tools to check
  check: (context) => {          // The actual check
    // Your logic here
    return { status: 'pass', ruleId: 'custom/my-rule' };
  },
};
```

## Step-by-Step

### 1. Create the Rule File

```bash
# src/rules/quality/no-barrel-imports.ts
```

### 2. Implement the Check

```typescript
import type { Rule, RuleResult } from '../../types.js';

export const noBarrelImports: Rule = {
  id: 'quality/no-barrel-imports',
  name: 'No Barrel Imports',
  description: 'Prevents importing from index/barrel files.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'quality/no-barrel-imports';
    const content = (context.toolInput.content as string) ?? '';

    if (!content) return { status: 'pass', ruleId };

    // Check for barrel imports
    if (/from\s+['"][^'"]+\/index['"]/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Barrel import detected. Import from specific files.',
        fix: 'Import directly: from "./Button" instead of from "./index"',
      };
    }

    return { status: 'pass', ruleId };
  },
};
```

### 3. Register the Rule

Add to `src/rules/quality/index.ts`:

```typescript
import { noBarrelImports } from './no-barrel-imports.js';
export const qualityRules: Rule[] = [..., noBarrelImports];
```

### 4. Write Tests

```typescript
import { describe, it, expect } from 'vitest';
import { noBarrelImports } from '../../../src/rules/quality/no-barrel-imports.js';

describe('quality/no-barrel-imports', () => {
  it('should warn on barrel imports', () => {
    const result = noBarrelImports.check(createContext(
      'import { Button } from "./components/index";'
    ));
    expect(result.status).toBe('warn');
  });

  it('should pass on direct imports', () => {
    const result = noBarrelImports.check(createContext(
      'import { Button } from "./components/Button";'
    ));
    expect(result.status).toBe('pass');
  });
});
```

### 5. Submit PR

```bash
git checkout -b feat/rule-no-barrel-imports
git commit -m "feat(rules): add quality/no-barrel-imports rule"
```

## Key Concepts

### HookContext

Your `check` function receives a `HookContext` with:

- `event` — `PreToolUse`, `PostToolUse`, or `Stop`
- `tool` — `Edit`, `Write`, `Bash`, `Read`, etc.
- `toolInput` — tool-specific data (file_path, content, command, old_string, new_string)
- `projectConfig` — resolved VibeCheck config
- `gitContext` — branch, isDirty, repoRoot, unpushedCount

### Edit Rule Factory

Write rules targeting the `Write` tool automatically get an Edit variant via `createEditVariant()`. This means your rule only needs to check file content — the factory handles the old-vs-new comparison for Edit operations, only flagging patterns that are newly introduced.

Set `editCheck: false` to disable this.

### Severity Levels

- **block** — prevents the operation (exit code 2)
- **warn** — allows but warns (advisory feedback)
- **info** — informational only

### Async Rules

Rules can be async:

```typescript
check: async (context): Promise<RuleResult> => {
  const exists = await checkFileExists(importPath);
  // ...
}
```

## Creating a Plugin

Package your rules as an npm plugin:

```typescript
import type { VibeCheckPlugin } from 'vibecheck';

const plugin: VibeCheckPlugin = {
  name: 'vibecheck-plugin-my-rules',
  version: '1.0.0',
  rules: [myRule1, myRule2],
  presets: [myPreset],
};

export default plugin;
```

Users install and configure:

```bash
npm install vibecheck-plugin-my-rules
```

```typescript
export default defineConfig({
  plugins: ['vibecheck-plugin-my-rules'],
});
```
