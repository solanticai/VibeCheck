---
name: custom-rules
description: Write custom VGuard rules for project-specific guardrails. Use when the user says "create custom rule", "write a rule", "add custom guardrail", or wants to implement project-specific checks.
args: rule_description
---

# Write Custom VGuard Rules

Create a project-specific guardrail rule that enforces custom coding standards via VGuard's plugin system.

## Required Information

Gather from the user:
- **Rule name**: kebab-case identifier (e.g., `no-hardcoded-api-urls`)
- **Category**: `security`, `quality`, `workflow`, `testing`, `maintainability`, `performance`, or `reliability`
- **Description**: What this rule prevents and why
- **Severity**: `block` (prevents operation), `warn` (allows but warns), `info` (informational)
- **Events**: Which hook events to listen on — `PreToolUse`, `PostToolUse`, `Stop`
- **Tools**: Which tools to match (e.g., `Write`, `Edit`, `Bash`, `Read`)
- **File patterns** (optional): Globs to match (e.g., `*.ts`, `src/**/*.tsx`)

## Step 1: Create the Rule File

Create a file at `src/rules/<category>/<rule-name>.ts` (or any location — the path is registered via config):

```typescript
import type { Rule, HookContext, RuleResult } from '@solanticai/vguard';

export const myCustomRule: Rule = {
  id: '<category>/<rule-name>',
  description: '<what this rule prevents>',
  severity: 'warn',
  events: ['PreToolUse'],
  tools: ['Write', 'Edit'],
  // Optional: glob patterns for file matching
  // filePatterns: ['src/**/*.ts'],
  // Optional: auto-generate an Edit variant for Write rules
  // editCheck: true,

  check(context: HookContext): RuleResult {
    try {
      const { toolInput, event, tool } = context;

      // Access the file path being edited/written
      const filePath = (toolInput as { file_path?: string })?.file_path ?? '';

      // Access the content being written
      const content = (toolInput as { content?: string; new_string?: string })?.content
        ?? (toolInput as { new_string?: string })?.new_string
        ?? '';

      // Your custom check logic here
      // Return { status: 'block' | 'warn' | 'info' } with a message to flag a violation
      // Return { status: 'pass' } to allow the operation

      if (content.includes('FORBIDDEN_PATTERN')) {
        return {
          status: 'block',
          message: 'This pattern is not allowed because <reason>.',
        };
      }

      return { status: 'pass' };
    } catch {
      // IMPORTANT: Always fail open — never block on internal errors
      return { status: 'pass' };
    }
  },
};
```

## Step 2: The HookContext Object

The `check()` function receives a `HookContext` with:

| Property | Type | Description |
|----------|------|-------------|
| `event` | `'PreToolUse' \| 'PostToolUse' \| 'Stop'` | Which hook event triggered |
| `tool` | `string` | The tool being used (Write, Edit, Bash, Read, etc.) |
| `toolInput` | `Record<string, unknown>` | The tool's input parameters |
| `projectConfig` | `ResolvedConfig` | The full resolved VGuard config |
| `gitContext` | `{ branch, isDirty, stagedFiles }` | Git state information |

### Common toolInput shapes

**Write/Edit**: `{ file_path: string, content?: string, old_string?: string, new_string?: string }`
**Bash**: `{ command: string }`
**Read**: `{ file_path: string }`

## Step 3: Register as a Plugin

Add the rule to `vguard.config.ts` using the `plugins` array:

```typescript
import { defineConfig } from '@solanticai/vguard';
import { myCustomRule } from './src/rules/quality/my-custom-rule';

export default defineConfig({
  presets: ['nextjs-15'],
  plugins: [myCustomRule],
});
```

## Step 4: Test the Rule

Create a test file alongside the rule:

```typescript
import { describe, it, expect } from 'vitest';
import { myCustomRule } from './my-custom-rule';
import type { HookContext } from '@solanticai/vguard';

function makeContext(overrides: Partial<HookContext>): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: {},
    projectConfig: {} as any,
    gitContext: { branch: 'main', isDirty: false, stagedFiles: [] },
    ...overrides,
  };
}

describe('my-custom-rule', () => {
  it('passes for valid content', () => {
    const result = myCustomRule.check(makeContext({
      toolInput: { file_path: 'src/app.ts', content: 'valid code' },
    }));
    expect(result.status).toBe('pass');
  });

  it('blocks forbidden pattern', () => {
    const result = myCustomRule.check(makeContext({
      toolInput: { file_path: 'src/app.ts', content: 'contains FORBIDDEN_PATTERN here' },
    }));
    expect(result.status).toBe('block');
  });

  it('fails open on error', () => {
    const result = myCustomRule.check(makeContext({
      toolInput: null as any,
    }));
    expect(result.status).toBe('pass');
  });
});
```

## Step 5: Regenerate and Verify

```bash
npx vguard generate
npx vguard rules    # Confirm the rule appears in the active list
```

## Key Principles

1. **Fail open**: Always wrap logic in try/catch and return `{ status: 'pass' }` on error
2. **Be specific**: Match only the tools and events your rule applies to
3. **Keep it fast**: Rules run synchronously on every hook event — avoid I/O
4. **Clear messages**: The `message` in the result is shown to the developer — make it actionable
