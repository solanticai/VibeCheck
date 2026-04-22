Explain what a VGuard preset does, which rules it bundles, and why you would want it.

## Required input

The user should provide a preset id (e.g. `nextjs-15`, `supabase`, `mcp-server`). If they didn't, ask.

## Steps

1. **Read the preset source** at `src/presets/<preset-id>.ts`. Every preset exports a `Preset` object with `id`, `name`, `description`, `rules`, and optionally `extends`.

2. **Walk the `rules` map** — for each entry:
   - Note the rule id, the configured severity (`block` / `warn` / `info` / `off`), and any per-rule options.
   - Cross-reference the rule source at `src/rules/<category>/<rule-name>.ts` to pull the one-line description.

3. **If the preset uses `extends`** — recursively resolve each parent preset and flag which rules come from where. Presets can only *downgrade* severity (never upgrade), so call out any rule the preset is intentionally quieting.

4. **Produce a brief** with these sections:
   - **Summary** — one sentence about what the preset is for.
   - **Bundled rules table** — id · severity · events · description · source preset (self or parent).
   - **Preset chain** — if `extends`, show the chain as `child → parent → grandparent`.
   - **When to use** — one paragraph covering which project types benefit.
   - **When NOT to use** — call out conflicts with common other presets (e.g. two framework presets both opining on file structure).

5. **Related presets** — suggest any presets that frequently pair with this one (e.g. `nextjs-15` + `react-19` + `typescript-strict`).

Return markdown formatted for terminal rendering.
