---
name: new-plugin
description: Scaffold a new VGuard plugin npm package that exports rules and/or presets. Use when the user says "create a plugin", "author a plugin", "publish a vguard plugin", or wants to ship guardrails as a reusable npm package.
args: plugin_name
---

# Create New VGuard Plugin: $ARGUMENTS

Generate a publishable VGuard plugin package that exports custom rules and/or presets.

## Trust Model Disclosure

**Read this first.** Plugins run with the full privileges of the vguard process. A plugin's top-level module code runs at load time; its `Rule.check()` bodies run inside every hook event. See [TRUST_MODEL.md §2](../../../TRUST_MODEL.md) before publishing.

The `VGUARD_NO_PLUGINS=1` escape hatch in `src/plugins/loader.ts` is what protects users running `vguard` against untrusted repos — your plugin must not assume it will always execute.

## What This Skill Creates

1. **Package skeleton** — `package.json`, `tsconfig.json`, `src/index.ts`
2. **Plugin entry point** — exports a `VGuardPlugin` object
3. **One example rule** and/or **one example preset**
4. **Test file** covering rule shape + validator round-trip
5. **README.md** with install snippet and trust-model link
6. **Publish checklist** (see below)

## Required Information

Ask the user for these if not provided:

- **Package name** — npm-scoped is strongly encouraged (`@your-org/vguard-plugin-<topic>`). Publishing under the `vguard-plugin-*` naming convention improves discoverability.
- **Rules vs presets vs both** — what the plugin ships.
- **Rule prefix** — e.g. `my-plugin/<rule-name>`. Must contain a `/` and must not collide with any built-in rule id (the validator in `src/plugins/validator.ts` enforces this).
- **Target events** — `PreToolUse`, `PostToolUse`, `Stop`, or the new `git:pre-commit` / `git:commit-msg` events if the rule is meant to run in native git hooks too.
- **License** — Apache-2.0 recommended for consistency with core.

## The `VGuardPlugin` Shape

From `src/types.ts`:

```ts
export interface VGuardPlugin {
  /** Plugin name (should match npm package name) */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Additional rules provided by this plugin */
  rules?: Rule[];
  /** Additional presets provided by this plugin */
  presets?: Preset[];
}
```

At minimum the plugin must export `name` and `version`. Without `rules` or `presets` the validator emits a warning (not an error), so a docs-only plugin is technically allowed.

## Implementation Steps

### 1. Package Skeleton

```
my-vguard-plugin/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # VGuardPlugin export
│   ├── rules/
│   │   └── example.ts    # one Rule per file
│   └── presets/
│       └── example.ts    # one Preset per file
├── tests/
│   └── index.test.ts
├── README.md
└── LICENSE
```

`package.json` essentials:

```json
{
  "name": "@your-org/vguard-plugin-example",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "peerDependencies": {
    "@anthril/vguard": "^3.0.0"
  },
  "files": ["dist"],
  "keywords": ["vguard", "vguard-plugin", "ai-guardrails"]
}
```

Use `@anthril/vguard` as a **peer dependency**, never a runtime dep — you want users' host VGuard install to be the single source of truth.

### 2. Plugin Entry — `src/index.ts`

```ts
import type { VGuardPlugin } from '@anthril/vguard';
import { exampleRule } from './rules/example.js';
import { examplePreset } from './presets/example.js';

const plugin: VGuardPlugin = {
  name: '@your-org/vguard-plugin-example',
  version: '0.1.0',
  rules: [exampleRule],
  presets: [examplePreset],
};

export default plugin;
```

Default-export is conventional — `src/plugins/loader.ts` reads `mod.default ?? mod`, so a named export also works.

### 3. Author a Rule

Follow the `/new-rule` skill's conventions. The one rule-specific constraint for plugins: the `id` **must include `/`** and **must not collide** with any built-in rule (`validatePlugin` in `src/plugins/validator.ts` will reject conflicts).

Recommended pattern: `<plugin-slug>/<rule-name>` — e.g. `my-plugin/no-hardcoded-secrets`.

### 4. Author a Preset (optional)

Same shape as `src/presets/*.ts` — mirror the existing presets. The preset `id` must not collide with built-in preset ids.

### 5. Tests

Exercise the validator round-trip so a CI failure catches id-collision regressions before publish:

```ts
import plugin from '../src/index.js';
import { validatePlugin } from '@anthril/vguard/internal/plugins/validator';

test('plugin passes validator', () => {
  const result = validatePlugin(plugin, plugin.name);
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
});
```

Also cover each rule's `check()` function with pass / block / fail-open cases (match the `/new-rule` test template).

### 6. Consumer Install Docs

Users add the plugin to their `vguard.config.ts`:

```ts
export default {
  plugins: ['@your-org/vguard-plugin-example'],
  rules: {
    'my-plugin/no-hardcoded-secrets': 'block',
  },
};
```

The README must include:

- Install: `npm install -D @your-org/vguard-plugin-example`
- A rules table (id, severity default, events)
- A trust-model note: "Like every VGuard plugin, this code runs with your vguard process's privileges. See the [VGuard Trust Model](https://github.com/anthril/vibe-guard/blob/master/TRUST_MODEL.md) before adopting."

### 7. Publish Checklist

- [ ] `npm run build` produces `dist/` (CJS + ESM + types)
- [ ] Validator test passes
- [ ] Rule `check()` tests cover pass, block, and fail-open
- [ ] README trust-model link present
- [ ] `peerDependencies."@anthril/vguard"` pinned to a range, not a single version
- [ ] `keywords` include `vguard-plugin` for npm discoverability
- [ ] `npm publish --access public` (if scoped)
- [ ] Submit a PR to `anthril/vibe-guard` adding the plugin to the community plugin index (if one exists)

## Verify Locally Before Publish

```bash
npm run build
npm link
cd /path/to/test-repo
npm link @your-org/vguard-plugin-example
# edit test-repo/vguard.config.ts to add the plugin
npx vguard doctor
npx vguard lint
```

The plugin should load, its rules should appear in `vguard rules list`, and `vguard doctor` should report no validation errors.
