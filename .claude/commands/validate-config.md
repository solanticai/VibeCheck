Validate a `vguard.config.ts` without running any hooks. Useful before committing config changes.

## Steps

1. **Run doctor in config-only mode:**
   ```bash
   npx vguard doctor --config
   ```
   This loads `vguard.config.ts`, parses it through the Zod schema, resolves presets and plugins, and reports:
   - Syntax errors (parse failures)
   - Schema errors (unknown fields, wrong types)
   - Plugin load failures
   - Preset / plugin rule id collisions
   - Unknown rule ids in the `rules` map

2. **If the config is valid**, additionally surface:
   - Effective severity per rule after preset merging (remember: presets can only *downgrade* severity)
   - Active plugin list and the rule/preset counts each plugin contributes
   - Agents that will receive generated output on the next `vguard generate`

3. **If the config is invalid**, for each error:
   - Show the exact file/line from the Zod error path
   - Explain the most likely fix (e.g. "severity must be one of 'block' / 'warn' / 'info' / 'off'")
   - Suggest a minimal diff when possible

4. **Trust-model reminder** — if the config declares any `plugins`, remind the user that plugin code executes with the vguard process's privileges (see [TRUST_MODEL.md §2](../../TRUST_MODEL.md)). Recommend `VGUARD_NO_PLUGINS=1` for hostile-repo linting.

5. Return the report; do not write anything to disk.
