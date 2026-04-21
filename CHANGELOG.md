# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Walker no longer follows symlinks.** `walkProject()` in
  `src/learn/walker.ts` now uses `lstatSync` and skips any entry whose
  `isSymbolicLink()` is true, closing an arbitrary-file-read path on
  shared dev hosts and CI agents where a symlink inside the project
  tree (e.g. `./spicy.txt -> ~/.ssh/id_rsa`) would previously be read
  into `learn`/`lint` processing context and could be forwarded to
  cloud sync. Following symlinks can be re-enabled per project in the
  future behind an explicit opt-in, but the default is now "never".
  Fixes #46.
- **Cloud URLs now pass through an allowlist guard.** `src/cloud/url-guard.ts`
  exports `assertSafeCloudUrl()` / `sanitiseBaseUrl()`, which require
  `https://`, reject `user:pass@` userinfo, and accept only
  `vguard.dev`, `api.vguard.dev`, and `*.supabase.co` hosts by default.
  Applied at every outbound dial site: `CloudClient` base URL, config push
  to the Edge Function host, the rule-hit streamer, the session-event
  streamer, the OAuth refresh path in `credentials.ts`, and both branches
  of `vguard cloud login`. A modified `~/.vguard/credentials.json` or
  hostile `VGUARD_CLOUD_URL` env var can no longer redirect refresh
  tokens, access tokens, or rule-hit payloads (which may contain source
  excerpts) to an attacker-controlled server. Local development against
  `localhost` / private IP ranges is still available behind an explicit
  `VGUARD_DEV=1`. Fixes #48.
- **Cloud credentials now prefer the OS keychain over the file.**
  `writeCredentials()` / `readCredentials()` default to the platform
  secret store (Windows Credential Manager, macOS Keychain, Linux
  Secret Service via `@napi-rs/keyring`) with the legacy
  `~/.vguard/credentials.json` path kept as a fallback for
  environments where the native binding is absent or no secret
  daemon is running. A new `VGUARD_CREDENTIAL_STORE` env var
  (`auto` / `keyring` / `file`, default `auto`) pins the backend
  explicitly for CI. On first read, a legacy file is transparently
  migrated into the keyring and the plaintext file is removed, so
  upgrading is zero-friction. `@napi-rs/keyring` ships as an
  `optionalDependencies` entry — installs that skip the native
  binding (exotic platforms, `--no-optional` CI) automatically land
  on the file fallback. Closes the "next-major" half of #47.
- **Credentials file is now ACL-locked on Windows.** The `mode: 0o600`
  in `writeCredentials()` was silently ignored on NTFS: Node does not
  map POSIX modes to Windows ACLs, so `~/.vguard/credentials.json`
  (access token, refresh token, API key — all plaintext) ended up
  readable by any local account in `BUILTIN\Users`. The new
  `src/cloud/acl-guard.ts` runs
  `icacls /inheritance:r /grant:r <user>:F` on the file after every
  `writeCredentials()` call so the on-disk ACL matches the 0o600 intent.
  POSIX remains a no-op. Fails open — `icacls` failures do not block
  `cloud login`. A follow-up (keychain-backed storage via
  `@napi-rs/keyring`) is tracked for the next major. Fixes #47.
- **Cloud exclusions now scrub message/metadata, not just `filePath`.**
  `applyExclusions()` in `src/cloud/sync.ts` used to null out `filePath`
  only, letting the excluded path and basename leak back out through
  any other string field on a rule-hit record (present today via
  `sessionId`; forward-compatible with future `message` / `metadata`
  fields). A `.vguardignore` entry of `secrets/**` or a
  `cloud.excludePaths` entry is now honoured across the whole record
  via a deep string scrub that also strips the basename.
- **Defence-in-depth secret scrubbing on every upload.** Known
  high-signal secret shapes (OpenAI `sk-…`, Anthropic `sk-ant-…`,
  Slack `xox[baprs]-…`, GitHub `gh[opusr]_…`, AWS `AKIA…`, Google
  `AIza…`, JWT triples) are now replaced with `[redacted]` on every
  uploaded rule hit regardless of exclusion config. Rules should not
  include secrets in their messages, but one leaked secret defeats the
  point of running a guardrail, so we scrub regardless. Fixes #50.
- **User-supplied regex patterns now run through a ReDoS validator.**
  Rules that compile `customPatterns` / `pattern` / `secretNamePattern`
  from `vguard.config.ts` used to pass the string straight to
  `new RegExp(...)`, letting a catastrophic-backtracking pattern like
  `(a+)+b` or `^(([a-z])+.)+[A-Z]([a-z])+$` hang a hook for seconds
  to minutes — which violates the "never block developer flow"
  contract. `src/utils/validate-regex.ts` adds
  `validateUserRegex(source, flags, { label })` with a structural check
  that rejects nested unbounded quantifiers applied to groups, plus a
  20 ms smoke test against a pathological input. Threaded through
  `workflow/high-impact-confirm`, `workflow/branch-naming`, and
  `security/mcp-credential-scope`. Rules fall back to their built-in
  defaults if a custom pattern is rejected, so config errors do not
  break enforcement. Fixes #49.

### Added

- **`TRUST_MODEL.md`** at the repo root, linked from `README.md`.
  Documents what running `vguard` against a repository actually executes
  (`vguard.config.ts` = code; plugins = full-trust; local rules =
  capped at warn), the cloud-sync redaction contract, and the
  mitigations available for CI or untrusted-input flows. Addresses
  #51.
- **`VGUARD_NO_PLUGINS=1` escape hatch.** Setting the env var causes
  `loadPlugins()` in `src/plugins/loader.ts` to short-circuit and
  return an empty result without executing any plugin module code.
  Built-in rules still run. Intended for CI runs against untrusted
  repos where declared plugins should not auto-execute. Addresses
  #51.
- **`loadValidatedConfig()` helper** in `src/config/load-validated.ts`
  plus a `ConfigValidationError` class. Consolidates the
  discover → read → Zod-validate flow so hand-edited config typos fail
  fast at one place with a `path.to.field: expected X` message instead
  of surfacing as cryptic TypeErrors deep in rule execution. `upgrade`
  now reads plugins through this helper. Addresses #55.
- **`cloudConfigSchema.streaming` sub-object** is now validated. The
  Zod schema gained a strict `streamingConfigSchema` covering
  `batchSize`, `flushIntervalMs`, `timeoutMs` (all positive integers),
  and `cloudConfigSchema` itself is now `.strict()` so typo'd keys
  like `flushInervalMs: 500` are rejected at config load rather than
  silently falling through to defaults. Fixes #54.
- **`monorepo.overrides` is now applied.** The field has been declared
  and schema-validated since v3.0 but was never consumed — a user
  could write `monorepo.overrides['apps/mobile'] = { presets: ['react-native'] }`
  and the preset would be silently ignored. New
  `src/config/workspace-overrides.ts` resolves the most-specific
  matching override key (fewest wildcards, longest literal prefix,
  declaration order) and `resolveConfigForFile(userConfig, filePath, presetMap)`
  layers the override's `presets` / `rules` over the root config
  before returning a `ResolvedConfig`. `vguard lint` now threads the
  raw config + presetMap into the scanner, which caches per-workspace
  resolutions so files in the same workspace share a rule set. Works
  with single-star (`apps/*`), double-star (`apps/**`), and literal
  (`apps/mobile`) keys. Runtime hooks still use the flat compiled
  config; extending `.vguard/cache/resolved-config.json` to persist
  the override table will land in a follow-up. Fixes #56.
- **Local-rule path list persisted into the pre-compiled config cache.**
  `vguard generate` now records the `.loaded` file list from
  `loadLocalRules()` into the new `localRulePaths` field of
  `.vguard/cache/resolved-config.json`. At hook time,
  `src/engine/hook-entry.ts` calls the new
  `loadLocalRulesFromPaths(projectRoot, paths)` helper instead of
  `loadLocalRules(projectRoot)`, skipping the `existsSync` +
  `readdirSync` scan on every tool invocation — a small per-hook
  saving, but hooks fire many times per session. Legacy caches
  without the field fall back to the scan-based loader, so no
  regeneration is required to upgrade. Stale cache entries (files
  deleted since the last `generate`) are recorded as errors and
  surfaced by `doctor`, not thrown. Tied to the follow-up noted on
  PR #66.
- **Project-local rule autoloader for `.vguard/rules/custom/`.** Rule
  files placed under `<projectRoot>/.vguard/rules/custom/**/*.{ts,js,mjs}`
  are now picked up at config resolution time and registered alongside
  built-in and plugin rules. Previously these files were orphans — the
  `auto-configure` skill wrote them and they looked valid, but nothing
  scanned the directory, so `vguard doctor` reported green while the
  rules were inert. Local rules are discovered by `lint`, `generate`,
  `rules list`, `doctor`, and by the runtime hook entry. Their
  effective severity is capped at `warn` (block-severity enforcement
  still requires a published plugin via `config.plugins`) to keep the
  supply-chain trust model explicit: anything that can stop a
  developer mid-edit has been through an npm publish. `doctor` now
  surfaces load errors, severity downgrades, and the registered-rule
  count under a `Local rules` check. Fixes #44.
- **`sweep-gitignore` skill** under `ai-for-vibe-guard/skills/`.
  Dispatches parallel category sub-agents (build artefacts, deps,
  IDE/OS cruft, secrets/env, logs/caches) to audit a repo for files
  that should be ignored, and produces a consolidated, dedup'd,
  evidence-backed `.gitignore` patch at
  `.vguard/GITIGNORE_SWEEP_REPORT.md`. Advisory only — never modifies
  `.gitignore` directly. Linked from
  `ai-for-vibe-guard/README.md`.

### Docs

- **`auto-configure` synthesizer + custom-rule template clarify
  `RuleResult.status`.** The type is `'pass' | 'block' | 'warn'` —
  there is no `'fail'` status. Added a dedicated section to
  `ai-for-vibe-guard/skills/auto-configure/prompts/synthesizer.md`
  and an inline NOTE to
  `ai-for-vibe-guard/skills/auto-configure/templates/custom-rule.ts.tmpl`
  so the generator chooses the right status and doesn't produce code
  that fails type-check.

### Changed

- **`monorepo.overrides` matcher compilation is now cached per
  `MonorepoConfig` reference.** Previously every `findWorkspaceOverride`
  call rebuilt a fresh `RegExp` per override key, so a lint run over
  a 1000-file monorepo with 10 overrides paid 10,000 RegExp
  constructions. Now a `WeakMap<MonorepoConfig, CompiledOverride[]>`
  stores pre-built matchers + pre-computed specificity scores, so the
  first lookup compiles once and every subsequent lookup against the
  same config reference is a table walk. `buildWorkspaceGlobRegex` is
  now a named export so the compile step is directly testable. Follow-up
  to the perf note on PR #66.
- **`vibeCheckConfigSchema` → `vguardConfigSchema`.** The Zod schema
  export was renamed to match the post-rebrand product name. The old
  identifier remains as a `@deprecated` re-export for one minor release
  so external callers can migrate without breakage. Addresses #57.2.

### Chore

- **Pre-commit hook now runs `npm run format:check`** alongside the
  existing lint + type-check. The previous hook shipped silent
  Prettier drift to CI — caught during the plan-completion audit on
  2026-04-22 when 9 of 12 in-flight PRs failed the `quality` job for
  format-only reasons. Drift now fails at `git commit` time with a
  clear Prettier message.
- **Pre-commit hook now rejects `package-lock.json` version drift.**
  The one-line Node guard runs after every commit attempt; on
  mismatch it points at `npm install --package-lock-only`. Closes
  the optional prevention half of #52 called out in PR #67.
- **Regenerated `package-lock.json`** after the v2.0.1 → v3.0.0 bump
  so the lockfile's top-level `version` field matches `package.json`.
  `npm ci` now reproduces the intended dev tree instead of the v2.0.1
  snapshot. Fixes #52.
- **Investigated `@emnapi/wasi-threads` and `tslib` "extraneous" report
  from #53.** Both packages are hoisted transitives of
  `@rolldown/binding-wasm32-wasi` (an optional WASM binding pulled in
  by rolldown/vite internals). No code in `src/` imports them and
  `npm ci` installs the same tree deterministically, so the
  "extraneous" flag is a cosmetic hoisting artifact rather than a
  supply-chain risk. A dedicated pre-commit version-match guard — the
  optional prevention half of #52 — is tracked as a follow-up so it
  lands with its own behavior-change review.

### Fixed

- **`vguard rules list` now reports the resolved severity for
  config-overridden rules.** The command used to emit the catalogue
  default (`rule.severity`) in both the human-readable table and the
  `--json` output, silently contradicting `config show` and the
  adapter-generated enforcement docs for any rule whose severity was
  overridden in `vguard.config.ts`. CI scripts that grepped
  `rules list --json` for blocking rules got wrong answers on any
  preset + user override combination. Now the command threads every
  rule through `resolved.rules` (the same source `config show` uses)
  and falls back to the catalogue default only when the config is
  unreadable. Fixes #45.

- `rollingWindowSpend(root, 0)` and the underlying `readUsage` filter
  now use strict `>` instead of `>=` for the `sinceIso` cutoff, so a
  zero-width window returns zero records deterministically (fixes a
  CI flake on fast runners where a just-written record shared the
  same millisecond timestamp as the cutoff).

### Testing

- Merged three GitHub Copilot Autofix PRs (#37, #38, #39) targeting
  test files: doctor-test import-ordering cleanup, npm-package-name
  boundary + scoped-uppercase assertions, and tighter eject template
  assertions. PRs #41 (comment-only cloud-login no-op) and #42 (against
  a file that no longer exists) were not merged.

## [3.0.0] - 2026-04-22

v3.0.0 consolidates three research-driven delivery cycles into a single
major release: the original 10-recommendation top-ups, the 13-wave
gap-closure (Waves 1–13), and the CLI UX + npm package audit follow-ups.
Net result: ~90 new rules, 15 new presets, 6 new reference plugins, and
4 new core features (fail-closed/hybrid enforcement mode,
policy-as-prompt synthesis, per-session token/cost budgets, chainable
rule ordering, HTTP webhook adapter, drift detection, real-time
dashboard).

### ⚠ BREAKING CHANGES

- **Default enforcement mode flipped to `hybrid`.** Previous default was
  `fail-open` (every internal rule error swallowed as a warning).
  `hybrid` fails closed on `block`-severity rules and fails open on
  `warn`/`info` — aligning VGuard with Microsoft AGT, Cycode, Straiker,
  Codex, and Rulebricks. Consumers relying on the historical behaviour
  can restore it by setting `enforcement: 'fail-open'` in
  `vguard.config.ts`. See _Added / Core features_ below.
- **`Rule` interface gained two optional fields** — `runAfter?: string[]`
  and `required?: boolean` — to support the new chainable rule ordering
  feature. Additive (existing rules compile unchanged), but plugin
  authors who extend the interface must widen their type defs.

### Added — Core features

- **Fail-closed / hybrid enforcement mode.** New `enforcement` field in
  `vguard.config.ts` accepts `'fail-open' | 'fail-closed' | 'hybrid'`
  (default: `'hybrid'`). Threaded through `types.ts`, `config/schema.ts`,
  `config/loader.ts`, and `engine/runner.ts`. Runner errors now map to
  block or warn per the configured mode.
- **Policy-as-prompt synthesis.** New `src/engine/prompt-synth.ts`
  exposes `synthesisePolicyPrompt(config, { agent })`. Bundles active
  rules by severity, wraps them in an explicit
  `VGUARD-POLICY-START/END` boundary to resist indirect prompt
  injection, and is consumed by the Claude Code adapter in place of the
  previous static `vguard-enforcement.md` template.
- **Per-session token/cost budgets.** New `src/engine/cost-tracker.ts`
  (append-only `.vguard/data/cost-usage.jsonl`, session + rolling-window
  summaries, per-model USD pricing) + `workflow/cost-budget` rule that
  blocks at `tokensPerSession`, `usdPerSession`, or `usdPerDay`
  thresholds.
- **Chainable rule ordering.** Rules can declare `runAfter: string[]`
  (topological sort in `engine/resolver.ts`) and `required: boolean`
  (runner skips a required rule when any declared predecessor blocked).
- **HTTP webhook adapter** (Wave 6). `src/adapters/http-webhook/` with
  `startWebhookServer()` (local `node:http`, POST `/hook/:event`,
  `{allowed, reason, warnings[]}` response) and `buildOpenApiSpec()`
  (OpenAPI 3.0.3 JSON for client codegen). New CLI commands
  `vguard webhook serve` and `vguard webhook spec`. Unlocks non-Node
  agents (Python, Rust, Go) via OpenAPI-generated clients.
- **Drift detection** (Wave 10). `vguard drift [--freeze] [--threshold N]
[--format text|json]` captures a conventions baseline into
  `.vguard/baseline.json`, diffs subsequent runs, and exits non-zero for
  CI when drift exceeds the threshold.
- **Real-time dashboard** (Wave 12). `vguard dashboard` starts a local
  HTTP server that serves a self-contained HTML page (`dist/dashboard/
index.html` — externalised asset, not an inline string) plus
  Server-Sent Events at `/stream` tailing `rule-hits.jsonl`. `fs.watch`
  with a 2-second poll fallback.
- **HTML visual report.** `vguard report --format html` emits a
  self-contained, zero-dependency `.vguard/reports/quality-report.html`
  (debt-score circle, outcome donut, rule-frequency bar chart, top
  blocked rules). `--format all` writes md + json + html.
  `prefers-color-scheme: dark` supported.
- **`auto-configure` AI skill** (`ai-for-vibe-guard/skills/
auto-configure/`). Dispatches 2–6 parallel profile sub-agents against
  a target repo (count scales with repo size), consolidates reports,
  and synthesises a custom `vguard.config.ts` plus repo-specific custom
  rules. Orchestrates the existing CLI — no core TypeScript changes.

### Added — Rules

**~90 new rules across security, quality, and workflow.** Full list
in the prior `[Unreleased]` log and in the gap-closure plan at
`.claude/plans/gap-closure-2026-04-21.md`. Key groups:

- **10 OWASP gap-close rules** (Wave 1): `security/egress-allowlist`,
  `destructive-scope-guard`, `credential-context-guard`,
  `agent-config-leakage`, `fetched-content-injection`,
  `untrusted-context-fence`, `agent-output-to-exec`,
  `secret-in-agent-output`, `workflow/autonomy-circuit-breaker`,
  `workflow/high-impact-confirm`.
- **7 MCP rules + `mcp-server` preset** (Wave 2):
  `mcp/stdio-command-validation`, `mcp/no-dynamic-tool-registration`,
  `mcp/tool-description-sanitize`, `mcp/capability-disclosure`,
  `security/mcp-url-scheme`, `security/agentsmd-integrity`,
  `security/untrusted-tool-registration`. Plus pre-existing MCP rules
  from the top-10 round: `mcp-server-allowlist`, `mcp-credential-scope`,
  `mcp-tool-description-diff`.
- **6 supply-chain rules** (Wave 3): `security/lockfile-required`,
  `rag-source-allowlist`, `embedding-source-integrity`,
  `tool-least-privilege`, `subagent-boundary`,
  `quality/package-existence-check`.
- **13 AI-code-pattern security rules** from Veracode Spring 2026 data:
  `log-injection`, `path-traversal`, `xxe-prevention`, `weak-crypto`,
  `insecure-deserialization`, `broad-cors`, `missing-authz`,
  `jwt-validation`, `quality/race-condition-hint`, plus extensions to
  `secret-detection` (Google / OpenAI / Anthropic / JWT patterns) and
  `unsafe-eval` (Python `exec` / `compile`).
- **Infra rules** (Wave 4): 6 K8s, 3 Bun, 4 MongoDB.
- **Backend/agentic rules** (Wave 7): 4 NestJS, 3 Nuxt, 3 tRPC, 3 Zod.
- **Next-ring ecosystems** (Wave 9): 4 Expo, 4 GraphQL, 3 Deno, 4 gRPC,
  4 Rails.
- **Low-signal presets' rules** (Wave 11): 3 Redis, 4 Phoenix/Elixir.
- **Branch-gated commit guards**:
  `workflow/require-changelog-on-protected-branches`,
  `workflow/require-version-bump-on-protected-branches`,
  `workflow/cost-budget`.

### Added — Presets

22 → 37 built-in presets. **15 new:** `dockerfile`, `langchain`,
`drizzle`, `terraform`, `mcp-server`, `kubernetes-manifests`, `bun`,
`mongodb`, `nestjs`, `nuxt`, `trpc`, `zod-validation`, `expo`,
`graphql`, `deno`, `grpc`, `rails`, `redis`, `phoenix-elixir`.

### Added — Reference plugins

2 → 8 plugins in the repo. **6 new:**
`@anthril/vguard-slack-notify`, `@anthril/vguard-cost-guardrails`,
`@anthril/vguard-secret-scanner-ext` (trufflehog/gitleaks wrapper),
`@anthril/vguard-pii-scrubber` (regex + Luhn, `pii-gdpr` preset),
`@anthril/vguard-license-check` (license-checker bridge,
`license-permissive` + `license-copyleft-safe` presets),
`@anthril/vguard-prompt-injection-guard` (`prompt-injection-defense`
preset), `@anthril/vguard-compliance-sbom` (syft + minimal SBOM
generator, `eu-cra-2026` preset), `@anthril/vguard-sast-bridge`
(semgrep / bandit / brakeman / sobelow, `sast-standard` preset).

### Added — CLI polish

- Help output for `dashboard`, `drift`, and `webhook` (+ `serve`,
  `spec`) now has examples blocks — matching the pattern used by
  `init`, `lint`, `report`. Every command gives at least one
  copy-pasteable invocation per flag/mode.
- `--version` output now includes the Node runtime version (e.g.
  `vguard 3.0.0 (<sha>, <date>, node v24.12.0)`) to make bug reports
  more actionable.
- No-args invocation inside a TTY with no VGuard config now appends a
  one-line setup hint: _"VGuard isn't configured in this directory yet
  — run `vguard init` to get started."_ TTY-gated so piped usage stays
  clean.
- README gains a **Terminal behaviour** section documenting
  `NO_COLOR`, `--no-color`, `--ascii`, `-q` / `--quiet`, `--verbose`,
  `--debug`, `CI=true` auto-detection, and non-TTY stdout behaviour.
- `scripts/derive-npm-tag.mjs` — single source of truth for dist-tag
  derivation (stable → `latest`, `-alpha.*` → `alpha`, etc.). Called by
  `.github/workflows/publish.yml` (replaces the inline bash mapping)
  and covered by 16 unit tests in
  `tests/scripts/derive-npm-tag.test.ts`.

### Changed

- **Default rule resolver is now topological.** Rules with `runAfter`
  declarations are sorted before execution; rules without preserve
  their registration order.
- **Dashboard HTML is a real asset.** Previously a template literal
  inside `src/dashboard/index.ts`; now lives at
  `src/dashboard/index.html` and is copied to `dist/dashboard/index.html`
  by the postbuild script. Enables IDE syntax highlighting.
- **SECURITY.md supported-versions table** updated to reflect 2.x/3.x
  reality (was stale at "1.x supported"). Added the "older majors get
  critical fixes for 90 days" policy line.
- **Published tarball is 49% smaller.** `package.json`'s `files` array
  excludes `dist/**/*.d.ts.map` (309 files, not useful to consumers)
  and the two CLI sourcemaps (`cli.js.map`, `cli.cjs.map`, 2.2 MB
  combined). Library sourcemaps retained for consumers debugging
  imports. Tarball 1.3 MB → 780 KB, unpacked 6.1 MB → 3.7 MB, file
  count 635 → 324.
- **Claude Code adapter rewired** to emit via `synthesisePolicyPrompt`
  instead of the old static template.

### Fixed

- `security/xxe-prevention` Java check was a no-op due to a regex
  negative-lookahead bug on a variable-length prefix. Rewritten as a
  two-pass check: the unsafe constructor must appear AND no recognised
  hardening feature must appear anywhere in the file. Hardening
  recognised: `disallow-doctype-decl`, `external-general-entities`,
  `external-parameter-entities`, `load-external-dtd`,
  `setXIncludeAware(false)`, `setExpandEntityReferences(false)`.
- `security/jwt-validation` decode-without-verify check now operates
  at function scope (walks backward from each `jwt.decode` to the
  enclosing `{`, forward-scans with brace balancing to the matching
  `}`, checks that scope for `jwt.verify`). Previously passed whenever
  any `jwt.verify` appeared anywhere in the file.
- `security/deno-import-map-pinning` scoped-package handling — previous
  regex `"(jsr|npm):([^@"][^"]*)"` rejected scoped specifiers like
  `jsr:@std/fs` that start with `@`. Rewritten to strip the scope
  prefix before checking for a `@version` suffix.
- `security/expo-no-experimental-rsc-in-prod` now accepts quoted JSON
  keys (`"reactServerComponents": true`) in addition to JS object
  syntax. Path matcher also accepts `.mjs`/`.cjs` variants.
- `security/credential-context-guard` kubectl-context regex now handles
  `kubectl --context=production delete` (stuff between `kubectl` and
  `delete`).
- `report` CLI debt-score colour mapping was inverted — green for high
  (bad) debt, red for low (good). Flipped to match the aggregator's
  "0-100, lower is better" documentation.
- `security/insecure-deserialization` regex had a useless `\-` escape
  that tripped ESLint and prevented the `serialize-javascript` pattern
  from matching.

### Removed

- `src/adapters/claude-code/templates/rules-template.ts` — orphaned
  after the Claude Code adapter was rewired to `synthesisePolicyPrompt`.

### Testing

- Test count: ~960 → **1420** (+460 new test cases).
- New consolidated test files for every wave's rules:
  `tests/rules/wave-{1,2,3,4,7,9,11}.test.ts`.
- Rule-registration smoke test (`tests/rules/
registration-coverage.test.ts`): verifies all 75 gap-closure rule
  IDs are present in the registry, have the expected `Rule` shape,
  and load without collision.
- New engine coverage: `tests/engine/{resolver-ordering,cost-tracker,
prompt-synth,runner}.test.ts`.
- New subsystems: `tests/adapters/http-webhook.test.ts`,
  `tests/dashboard/dashboard.test.ts`, `tests/learn/baseline.test.ts`,
  `tests/scripts/derive-npm-tag.test.ts`, and the Wave 8 / Wave 13
  plugin test files.

## [2.0.2] - 2026-04-21

### Added

- **`doctor --json` and `--strict`** — `vguard doctor` now emits a stable JSON
  payload (`{status, strict, checks[]}` with `schema` field for versioning)
  for CI consumption. `--strict` promotes any warning to a failure. See the
  new "Exit codes" section in the README for how to gate deploys on these.
- **Global `--quiet` / `--verbose` flags** — `--quiet` (alias `-q`) suppresses
  banners, progress spinners, and summaries while preserving machine output
  on stdout. `--verbose` prints extra `[verbose]` diagnostic lines on stderr.
  Mutually exclusive.
- **NDJSON lint format** — `vguard lint --format ndjson` emits one
  JSON object per line (a `type:"summary"` envelope followed by
  `type:"issue"` records), stable under `schema: "v1"`.
- **Dynamic shell completions** — `vguard completion <bash|zsh|fish|powershell>`
  now tab-completes real rule IDs, preset IDs, and `preset:<id>` variants by
  invoking the CLI's `--json` listing commands at tab time. Static subcommand
  completions retained.
- **Full sysexits exit-code mapping** — commands now return sysexits-style
  codes so CI scripts can branch precisely: `2` (USAGE), `66` (NO_INPUT),
  `69` (UNAVAILABLE), `70` (SOFTWARE), `77` (NO_PERM), `78` (CONFIG),
  `130` (SIGINT). `0` and `1` (LINT_BLOCKING) unchanged. Documented in
  the README.
- **`init` non-interactive mode** — new `--yes`, `--preset`, `--agent`,
  `--protected-branches`, `--cloud`/`--no-cloud` flags let CI / scripts
  configure VGuard without prompts. `init --force` now confirms before
  overwriting and refuses in non-interactive mode unless `--yes` is passed.
- **Top-level error boundary** — fatal errors print `vguard: error: <msg>`
  and hide the stack trace unless `--debug` or `DEBUG=vguard*` is set.
- **Global SIGINT handler** — Ctrl+C during any command exits cleanly
  with code 130. Inquirer's `ExitPromptError` is recognised and handled
  silently (no ugly "User force closed the prompt" line).
- **Short flag aliases** — `-f`/`-y`/`-p`/`-a`/`-b`/`-j`/`-o`/`-n` added
  across `init`, `lint`, `report`, `eject`, `fix`, `sync`, `rules list`,
  `presets list`, `config show`, `cloud login`.
- **Mutually exclusive `upgrade --check` / `--apply`** — passing both now
  errors with a clear message.
- **`--version` / `version` unified** — both emit the same
  `vguard 2.0.2 (<sha>, <date>)` string, injected at build time via tsup
  `define` instead of an fs lookup.
- **Examples in every command's `--help`** — `init`, `add`, `remove`,
  `generate`, `doctor`, `lint`, `learn`, `report`, `eject`, `upgrade`,
  `fix`, `cloud login`, `completion`, and the sub-groups all have
  copy-pasteable example blocks.
- **Consistent banner / colour / glyph system** — every command now uses
  the new `banner()`/`color.*`/`glyph()` helpers. ASCII fallback via
  `--ascii` or `LANG=C`/`TERM=dumb`. No more raw `✓`/`✗` bytes or
  ad-hoc `VGuard X — Y` strings.

### Changed

- **`vguard add` / `remove` argument is now optional** ([#34](https://github.com/anthril/vibe-guard/issues/34)) —
  running either command without an id no longer emits commander's terse
  "missing required argument" error. Instead, VGuard prints a structured
  help block with real example ids, the discovery commands
  (`vguard rules list --all`, `vguard presets list`), and exits with
  code 2 (USAGE).
- **`reliability/no-unhandled-promises` rule rewritten** ([#33](https://github.com/anthril/vibe-guard/issues/33)) —
  the previous 3-line-window `.catch` lookahead produced false positives
  on any legitimately multi-line `.then(...)` body. Detection is now
  chain-aware: strings and comments are masked, `.then(...)` closing
  parens are matched, the two-argument `.then(onOk, onErr)` form is
  recognised as handled, and the scan walks forward at brace/paren depth
  zero until the enclosing statement ends. Fixes the common
  `promise.then(longBody).catch(handler)` false-positive pattern.
- **Group commands show help on stdout, exit 0** — `vguard rules`,
  `vguard presets`, `vguard config`, `vguard cloud`, `vguard ignore`
  (no subcommand) now print their help to stdout with a zero exit code
  instead of commander's default "exit 1 via stderr".
- **`doctor` exits non-zero on fail** — previously `vguard doctor` exited
  `0` even when checks failed, making it unsuitable as a CI gate. It now
  exits `78` (EX_CONFIG) when any check fails.
- **Inquirer migration** — replaced the legacy `inquirer@13` default
  export with `@inquirer/prompts@8` named exports. Resolves a CJS-interop
  crash that broke `vguard init` for all users on 2.0.x.
- **Commander `exitOverride` applied recursively** — every subcommand
  now routes usage errors through the top-level error boundary so exit
  codes follow the sysexits mapping (previously a subcommand's bad-flag
  error bypassed the boundary and exited with commander's default `1`).

### Fixed

- **`--version` reported `0.0.0`** — the version lookup relied on a
  relative-path `fs.readFileSync` that didn't work in the flat `dist/`
  bundle. Version is now injected at build time.
- **`vguard init` crashed with a raw stack trace** — inquirer v13's
  default export didn't round-trip through tsup's CJS emission. Swapped
  to `@inquirer/prompts`.

### Removed

- **Legacy `inquirer` dependency** — replaced by `@inquirer/prompts`.
- **Dead code in `src/cli/commands/lint.ts`** — `isValidLintFormat` and
  `LINT_FORMAT_CHOICES` were superseded by commander's `.choices()`.

## [2.0.1] - 2026-04-12

### Fixed

- **GitHub URLs** — corrected casing in all GitHub URLs from
  `github.com/Anthril` to `github.com/anthril` to match the
  canonical GitHub username. Affects README badges, sponsor links,
  generated hook rule documentation, and release skill templates.

## [2.0.0] - 2026-04-12

### Changed

- **BREAKING: npm scope renamed** — package published as `@anthril/vguard`
  (previously `@solanticai/vguard`). Update your `package.json`:
  ```diff
  - "@solanticai/vguard": "^1.8.3"
  + "@anthril/vguard": "^2.0.0"
  ```
  Then run `npx vguard generate` to regenerate hooks with the new import paths.
- **GitHub org renamed** — all repository URLs, CI badges, sponsor links,
  and documentation now reference `github.com/anthril` instead of
  `github.com/solanticai`.
- **Author and contact updated** — author field changed from "Solantic Ai"
  to "Anthril". Security reports: `security@anthril.com`. General contact:
  `info@anthril.com`.
- **Generated hook imports updated** — `vguard generate` now emits
  `import { executeHook } from '@anthril/vguard/hooks/runner'` in
  generated hook scripts. Existing hooks using the old scope will
  continue to work until regenerated.
- **CLI upgrade command** — `vguard upgrade` now checks for updates to
  `@anthril/vguard` instead of the old package name.
- **Plugin marketplace** — the official Claude plugin marketplace has been
  renamed from `solanticai-official-claude-plugins` to
  `anthril-official-claude-plugins`. Existing marketplace users should
  re-add the marketplace under the new name.

### Removed

- `learn.ignorePaths` and `cloud.excludePaths` config fields (deprecated
  since v1.7.0). Use `.vguardignore` instead.

### Migration Guide

1. Install the new package:
   ```bash
   npm uninstall @solanticai/vguard
   npm install -D @anthril/vguard@2.0.0
   ```
2. Update your `vguard.config.ts` import:
   ```diff
   - import { defineConfig } from '@solanticai/vguard';
   + import { defineConfig } from '@anthril/vguard';
   ```
3. Regenerate hooks: `npx vguard generate`
4. Remove deprecated config fields (`learn.ignorePaths`,
   `cloud.excludePaths`) and use `.vguardignore` instead.

## [1.8.3] - 2026-04-09

### Changed

- **build** — extracted fragile inline `node -e` calls from the build script
  into a dedicated `scripts/postbuild.mjs` for maintainability and
  debuggability.
- **build** — `dist/hooks/runner.d.ts` is now auto-generated by parsing
  the source export from `src/engine/hook-entry.ts`, so it stays in sync
  automatically instead of being hardcoded.
- **package.json** — added `"prepublishOnly"` script (`npm run build && npm test`)
  as a safety net against accidental local publishes without building.
- **package.json** — added `"sideEffects"` field listing only the rule and
  preset registration modules, enabling tree-shaking for library consumers.
- **package.json** — added `"./package.json": "./package.json"` subpath
  export for tools that need to read package metadata.

### Fixed

- **cli/upgrade** — replaced `execFileSync` with `execSync` (shell mode)
  so the upgrade command works on Windows where npm is a `.cmd` shim.
- **deps** — updated `vite` dev dependency past 8.0.4 to resolve 3
  high-severity advisories (path traversal, `server.fs.deny` bypass,
  WebSocket file read). Dev-only — does not affect published package.

### Added

- **tests** — 69 new tests across 6 files covering previously low-coverage
  modules: cloud credentials, config-pusher, sync, stdin, eject templates,
  and hook-entry. Total test count: 998.

## [1.8.2] - 2026-04-06

### Added

- **cli/init --force** — reconfigure VGuard from scratch, overwriting an
  existing `vguard.config.ts` instead of exiting early.
- **ai-for-vibe-guard/** — 6 AI-readable SKILL.md files (setup-vguard,
  add-rules, configure-presets, cloud-connect, troubleshoot, custom-rules)
  that AI coding assistants can reference to install, configure, and debug
  VGuard in any project.

### Fixed

- **cloud/session-end sync** — when `cloud.enabled` is true but `autoSync`
  is off, a batch sync (rule hits + config snapshot + session events) now
  fires at SessionEnd so data reaches the dashboard without real-time
  streaming.

## [1.8.0] - 2026-04-06

### Added

#### 5 new rule categories — 14 rules

Expands the guardrail suite from 35 to 49 built-in rules across 5 new
categories: **performance**, **maintainability**, **testing**,
**reliability**, and **documentation**.

- **performance/bundle-size** — warns on full-library imports of lodash,
  moment, rxjs. Suggests tree-shakeable alternatives.
- **performance/no-sync-io** — warns on readFileSync, execSync, and
  other synchronous IO that blocks the event loop.
- **performance/image-optimization** — warns on raw `<img>` tags in JSX
  files. Suggests next/image or framework-specific alternatives.
- **maintainability/cyclomatic-complexity** — warns when function
  complexity exceeds a configurable threshold (default: 10).
- **maintainability/max-function-params** — warns when functions have
  more than 4 parameters. Suggests options-object pattern.
- **maintainability/no-deep-nesting** — warns when brace nesting
  exceeds 4 levels. Suggests early returns and extraction.
- **maintainability/consistent-returns** — warns when a function mixes
  value-returning and void-returning code paths.
- **maintainability/no-god-files** — warns when a file has more than 15
  exports, suggesting it should be split into focused modules.
- **testing/no-test-skip** — warns on .skip(), .only(), xit(),
  xdescribe() in test files. These disable tests silently.
- **testing/mock-cleanup** — warns when vi.mock()/jest.mock() are used
  without afterEach cleanup.
- **testing/assertion-count** — warns when test blocks have zero
  expect() assertions.
- **testing/no-snapshot-abuse** — warns when test files overuse
  snapshot assertions (default limit: 3).
- **reliability/no-unhandled-promises** — warns on .then() without
  .catch() on the same promise chain.
- **documentation/public-api-jsdoc** — warns when exported functions
  and classes lack JSDoc comments.

#### Shared code-analysis utility

- New `src/utils/code-analysis.ts` with `extractFunctions()` (brace-
  counting function extractor), `isTestFile()`, and `isGeneratedFile()`
  helpers shared across the 14 new rules.

#### Preset updates

- Updated 13 presets (nextjs-15, react-19, typescript-strict, vue,
  sveltekit, astro, express, go, python-strict, supabase, prisma,
  remix, react-native) with relevant new rules.

### Changed

- Session lifecycle handler now reads agent type from config instead
  of hardcoding `'claude-code'`.
- `.gitignore` now excludes `.vguard/data/rule-hits.jsonl`.

## [1.7.0] - 2026-04-05

### Added

#### `.vguardignore` — project-wide file exclusion

- **`.vguardignore` file support.** VGuard now reads a project-level
  `.vguardignore` (gitignore syntax) that excludes files and folders
  from every VGuard execution path — `vguard lint`, Claude Code
  runtime hooks (PreToolUse / PostToolUse), and `vguard learn`. This
  solves the common complaint that auto-generated UI libraries
  (shadcn/ui) and frozen SQL migrations were surfacing false-positive
  violations that had no clean project-wide opt-out.
- **`vguard init` creates a starter `.vguardignore`** with active
  defaults (generated-code globs, IDE/OS cruft) plus commented hints
  for common opt-ins (`src/components/ui/`, `supabase/migrations/`,
  `prisma/migrations/`, snapshot/fixture folders). Existing
  `.vguardignore` files are never overwritten.
- **New `vguard ignore` subcommand** for managing the file without
  opening it: `vguard ignore list` prints active patterns grouped by
  source (defaults vs file), `vguard ignore add <pattern>` / `remove
<pattern>` edit the file safely (dedupes, preserves comments),
  `vguard ignore check <path>` reports whether a path is ignored and
  which pattern matched, and `vguard ignore init` standalone-creates
  the file for projects that predate v1.7.0.
- **`vguard doctor` new check** reports `.vguardignore` status and
  active pattern count, and warns when legacy `learn.ignorePaths` or
  `cloud.excludePaths` config fields are set (with guidance to move
  them into `.vguardignore`).

#### Session tracking

- Session tracking: Claude Code's `session_id` hook payload is now
  captured on every hook invocation and attached to every rule-hit
  record. Previously `session_id` was silently discarded, which meant
  every synced `rule_hits.session_id` on the cloud dashboard was null
  and sessions could not be grouped, filtered, or drilled into.
- New `SessionStart` and `SessionEnd` Claude Code hooks are generated
  by the claude-code adapter. Both are always registered (regardless
  of active rules) and run matcher-less. They write lifecycle markers
  to `.vguard/data/session-events.jsonl` with branch, cli_version,
  agent, and cwd metadata, then fire a best-effort flush to the new
  cloud `/api/v1/sessions/events` endpoint.
- New `session-tracker.ts` / `session-streamer.ts` modules maintain
  an append-only JSONL log of session lifecycle events and stream
  them to the cloud with cursor-based deduplication. Fail-open
  throughout — session telemetry never blocks developer work.
- `HookContext` now carries an optional `sessionId` field, so custom
  rules can read the active session id if they need it (e.g. to
  include it in messages or autofix metadata).

#### CLI commands as project scripts

- `vguard init` now exposes **every** VGuard CLI command as a
  namespaced `vguard:*` script in the project's `package.json`.
  Previously only six commands were injected (`lint`, `fix`, `doctor`,
  `sync`, `report`, and the base `vguard` alias); now all 16 commands
  are registered — including `vguard:generate`, `vguard:learn`,
  `vguard:upgrade`, `vguard:eject`, `vguard:add`, `vguard:remove`,
  and the four `vguard:cloud:*` subcommands. Users can run
  `npm run vguard:<cmd>` for any command without having to remember
  the full CLI surface.
- `.vguard/COMMANDS.md` is now generated on `vguard init` and
  refreshed on `vguard generate`. This is a universal reference file
  that lists every CLI command grouped by category (Setup, Quality,
  Analysis, Maintenance, Cloud) with its description, npm script
  shortcut, and argument-passthrough hints. It also serves projects
  that don't have a `package.json` ("the project's equivalent file"),
  giving every project a single, local, discoverable index of every
  VGuard command.
- `vguard generate` now refreshes the `vguard:*` scripts list and
  rewrites `.vguard/COMMANDS.md` as part of its normal flow. This
  ensures that new commands added in future VGuard releases
  automatically surface in existing projects the next time they
  regenerate their hooks — no manual `package.json` edits required.

### Changed

- `vguard learn` now merges `.vguardignore` with its existing
  `learn.ignorePaths` config field — they compose, so users don't
  have to choose. Same pattern for `cloud.excludePaths` in the sync /
  streamer privacy filter.
- `vguard generate` now clears the ignore-matcher cache so edits to
  `.vguardignore` propagate to the next hook / lint run without
  needing to restart the process.
- `RuleHitRecord` (the JSONL shape written to
  `.vguard/data/rule-hits.jsonl`) now carries an optional `sessionId`
  field. Existing records without `sessionId` remain valid.
- `recordRuleHit()` gained an optional `sessionId` parameter. Call
  sites inside the CLI pass the session id extracted from stdin;
  the parameter is backward compatible for any external callers.
- `vguard generate` refreshes `.claude/settings.json` to include the
  new SessionStart/SessionEnd hook entries. Existing projects only
  need to re-run `vguard generate` once to start forwarding session
  lifecycle events.
- The command registry has moved to `src/utils/command-registry.ts`
  as a single source of truth shared by `init`, `generate`, and the
  `COMMANDS.md` renderer. Additions to the CLI only need to be
  registered in one place to appear across all surfaces.
- Added `ignore@^7.0.5` as a runtime dependency. This is the same
  ~8KB MIT package used by ESLint, Prettier, and stylelint for full
  gitignore semantics (negation with `!`, directory suffixes, globs,
  comments, nested patterns).

### Deprecated

- `learn.ignorePaths` and `cloud.excludePaths` config fields — both
  still work unchanged but are bridged into the new `IgnoreMatcher`.
  `vguard doctor` surfaces a deprecation hint when either is set.
  Plan to remove in v2.0.

## [1.4.1] - 2026-04-05

### Fixed

- Config-snapshot push now includes the `cloud` block (`enabled`,
  `autoSync`, `projectId`, `excludePaths`) so the dashboard's resolved-
  config summary can correctly render "Cloud sync: enabled" for
  projects that have streaming turned on. In 1.4.0 the cloud fields
  were silently omitted from the payload, which made every project
  show as "Cloud sync: disabled" even when real-time streaming was
  working.
- `vguard cloud connect` now upserts `enabled: true` and `autoSync:
true` into an existing `cloud: { … }` block in vguard.config.ts,
  not just `projectId`. Before this fix, a user who had previously
  set `enabled: false` or `autoSync: false` and then ran
  `cloud connect` would get their project ID updated but would still
  have cloud sync disabled. Connecting a project to the cloud is an
  explicit opt-in, so those flags now get flipped to true every time.

## [1.4.0] - 2026-04-05

### Added

- Config-snapshot sync: the hook runner now pushes the resolved project
  configuration + CLI version to VGuard Cloud whenever the resolved
  config hash changes or 24h have passed since the last push. This
  populates `projects.config_snapshot` and `projects.vguard_version`
  in the cloud database, which in turn lights up the dashboard's
  Active Presets, Quick Stats, Project Rules, Config Resolution
  Pipeline, and version-badge widgets. Previously those widgets were
  always empty because nothing in the CLI ever wrote to those columns.
  Override the endpoint host via `VGUARD_FUNCTIONS_URL` for self-hosted
  Supabase projects.
- `vguard sync` command also pushes the config snapshot after a
  successful rule-hits sync, as a manual fallback when hooks are
  disabled or haven't run recently.

### Changed

- `.husky/pre-commit` now skips the CHANGELOG.md / version-bump checks
  when a merge is in progress (detected via `.git/MERGE_HEAD`). Merge
  commits consolidate existing history and don't introduce new entries,
  so blocking them forced empty CHANGELOG edits that added no value.
  Lint and type-check still run on every commit, including merges.

### Fixed

- Cloud sync default URL now points to `https://vguard.dev` instead of the
  non-resolving `https://api.vguard.dev` / `https://app.vguard.dev` subdomains.
  Affected the streamer (`/api/v1/ingest`), CloudClient base URL, and the
  `cloud login` / `cloud connect` browser URLs. Users can still override via
  `VGUARD_CLOUD_URL`.
- `vguard cloud connect --key <vc_...> --project-id <id>` now always writes
  the API key + project ID to `~/.vguard/credentials.json`, even when the
  user has not previously run `vguard cloud login`. Previously the
  credentials file was only updated if it already existed, which meant
  Claude Code hooks had no way to read the API key and silently skipped
  real-time cloud streaming.
- Prettier formatting applied to 6 new rule and test files

## [1.3.0] - 2026-04-04

### Added

- 10 new built-in rules (25 → 35 total):
  - `security/unsafe-eval` — blocks eval(), new Function(), string setTimeout
  - `security/no-hardcoded-urls` — warns about hardcoded localhost and API URLs
  - `security/xss-prevention` — warns about dangerouslySetInnerHTML, innerHTML, v-html
  - `security/sql-injection` — blocks string-interpolated SQL queries
  - `quality/no-any-type` — warns about `any` type usage in TypeScript
  - `quality/error-handling` — warns about empty catch blocks
  - `quality/a11y-jsx` — accessibility checks for JSX (missing alt, onClick on divs)
  - `quality/magic-numbers` — flags numeric literals that should be named constants
  - `workflow/branch-naming` — enforces branch naming conventions (feature/, fix/, chore/)
  - `workflow/lockfile-consistency` — reminds to update lockfile after dependency changes
- 4 new presets (14 → 18 total): `vue`, `remix`, `prisma`, `express`
- `/release` skill for automated release lifecycle (version bump, changelog, PR, CI, discussion)
- Cloud streaming module for real-time rule hit telemetry

### Changed

- Updated 7 existing presets with new security and quality rules:
  - `nextjs-15`: added unsafe-eval, no-hardcoded-urls, error-handling, a11y-jsx
  - `typescript-strict`: added no-any-type, error-handling, unsafe-eval
  - `react-19`: added a11y-jsx, xss-prevention
  - `supabase`: added sql-injection
  - `django`: added xss-prevention, sql-injection
  - `fastapi`: added sql-injection
  - `laravel`: added xss-prevention, sql-injection
- Publish workflow: removed automated changelog discussion job (moved to `/release` skill)
- Cloud init flow updated for improved authentication handling

### Removed

- `/project:release` command (replaced by `/release` skill)
- `/project:publish-changelog` command (replaced by `/release` skill)
- Automated changelog discussion job from publish workflow

## [1.1.2] - 2026-04-03

### Fixed

- Publish workflow: add NODE_AUTH_TOKEN env for npm OIDC authentication

## [1.1.1] - 2026-04-03

### Changed

- CI workflow triggers on pull_request only (removed redundant push triggers)
- Test matrix: full 3 OS x 2 Node for PRs to master, Ubuntu + Node 22 only for PRs to dev
- Merged lint, format, and type-check into a single `quality` job
- Removed redundant `validate` job from publish workflow (CI already gates the PR)

### Fixed

- Prettier formatting applied to 25 files (tests, docs, fixtures)
- CI release-checks job now passes (instead of skipping) on push events

## [1.1.0] - 2026-04-03

### Added

- DEVELOPERS.md with full developer guide (setup, architecture, testing, extension guides)
- Makefile rewritten for VGuard contributor sync across vibe-guard and vibe-guard-cloud repos

### Fixed

- Lint errors in test files: removed unused imports and variables across 5 test files
- Replaced `require()` with dynamic `import()` in walker test to satisfy ESLint no-require-imports rule

## [1.0.0] - 2026-04-02

First stable release.

### Highlights

- **21 built-in rules**: 7 security, 11 quality, 7 workflow
- **14 presets**: nextjs-15, typescript-strict, react-19, supabase, tailwind, django, fastapi, laravel, wordpress, react-native, astro, sveltekit, python-strict, go
- **5 adapters**: Claude Code (runtime), Cursor, Codex, OpenCode, GitHub Actions
- **16 CLI commands**: init, add, remove, generate, doctor, lint, learn, report, eject, upgrade, fix, cloud login/logout/connect/status, sync

### Added

- Core rule engine with async-capable `check()` and `createEditVariant()` factory
- Config system with TypeScript support (via jiti), preset merging, pre-compilation
- Rule Profiles: `strict`, `standard`, `relaxed`, `audit` for bulk severity configuration
- Autofix API: Machine-applicable fixes via `vibecheck fix`
- Monorepo support with per-workspace config overrides
- Config inheritance via global `~/.vibecheck/config.ts`
- Convention learning engine with import, naming, and structure analyzers
- Quality dashboard with rule hit tracking and markdown reports
- Plugin API for third-party rules and presets
- Eject command for standalone hook export (removes VGuard dependency)
- Upgrade command with npm registry check and semver comparison
- Cloud sync: credentials management, API client, batch upload to VGuard Cloud
- Performance budget: 100ms p95 target with instrumentation and auto-downgrade

### Security

- Shell injection prevention: all subprocess calls use `execFileSync` with array arguments
- npm package name validation on plugin names and config
- Stdin parsing capped at 2 MB to prevent memory exhaustion
- Credential file permissions restricted to `0o600`
- Runtime hook event validation against known values
- File path validation before git commands
- Explicit opt-in required for cloud auto-sync
