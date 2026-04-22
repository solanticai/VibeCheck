Detect rule conflicts, event-ordering issues, and redundant coverage across the currently-enabled rule set.

## Steps

1. **Resolve the active rules:**
   ```bash
   npx vguard rules list --format json
   ```

2. **Check for event overlap conflicts.** Two rules that fire on the same event for the same file/tool pattern but emit contradictory advice create real bugs. For each `(event, tool, match)` triple, flag:
   - Rules whose `match` globs overlap
   - Rules that would both block on the same trigger — surface them so the user can decide which is canonical

3. **Check for redundant coverage.** Look for rules that semantically replicate each other — e.g. two rules that both guard against the same hardcoded-secret pattern. Heuristics:
   - Rule ids that share a common suffix (`*-no-eval`, `*-no-eval-ffi`)
   - Rules tagged with the same category/severity that match identical globs
   - Plugin rules that duplicate a built-in (`my-plugin/no-console` vs built-in `quality/no-console-log`)

4. **Check for preset conflicts.** If two enabled presets set the same rule to different severities, the *lower* (more permissive) wins — call this out because it's almost always unintended. Source the data from `src/config/presets.ts` / `src/presets/*.ts`.

5. **Check event ordering.** Some rules only make sense before or after others (e.g. `format-on-save` should not precede `lockfile-consistency`). If the runner order matters for any rule, flag it.

6. **Report format** — for each finding, include:
   - Severity (`error` for real conflicts, `warn` for redundancies, `info` for ordering hints)
   - Rule ids involved
   - A suggested resolution (disable one, downgrade severity, change `match`, or intentionally keep both)

7. **If everything is clean**, say so in one line so the command is useful as a CI check.
