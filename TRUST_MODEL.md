# VGuard Trust Model

This document describes what running VGuard against a repository actually
executes, so you can make an informed call before pointing it at code
you didn't author.

Short version: **running any `vguard` command against a repository is a
trust decision equivalent to `npm run <script>` on that repository.**
Keep that sentence in mind and the rest of this document is detail.

## What actually executes

### 1. `vguard.config.ts` is code, not data

VGuard's config is a TypeScript/JavaScript file loaded via
[jiti](https://github.com/unjs/jiti) in `src/config/discovery.ts`.
Anything at the top level of `vguard.config.ts` — `import`s, top-level
`await`s, `console.log`s, network calls, file reads — runs on every
`vguard` invocation, including `vguard doctor`, `vguard lint`, and every
hook event.

This is idiomatic for TS config (Next.js, Vite, Drizzle, ESLint flat
config all work this way), but it is not hedged in the docs. Loading a
`vguard.config.ts` from a hostile repository is equivalent to running
`node ./vguard.config.ts` with your normal user permissions.

### 2. Plugins are full-trust

`config.plugins: ['@your-org/vguard-plugin-x']` is loaded by
`src/plugins/loader.ts` via a dynamic `import()`. The plugin's module
code runs at load time; the `Rule.check()` bodies it exports run inside
every tool-call hook.

`validatePlugin()` in `src/plugins/validator.ts` enforces the object
_shape_ but does not sandbox behaviour. A plugin can:

- read files on disk, including `.env`, `~/.ssh`, and other repo
  contents;
- call `fetch()` anywhere on the network;
- spawn child processes;
- mutate your environment.

This is the same trust you extend to any npm package under
`dependencies`. Be selective about who you install.

### 3. Hooks generated under `.vguard/hooks/` are deterministic

`vguard generate` compiles the current config into small Node scripts
under `.vguard/hooks/`. Reviewing `vguard.config.ts` is equivalent to
reviewing the hooks — rerunning `vguard generate` will reproduce them
byte-for-byte.

### 3a. Native git hooks under `.git/hooks/`

`vguard install-hooks` writes two POSIX shell scripts to `.git/hooks/`:
`pre-commit` and `commit-msg`. Each script carries the literal marker
`# vguard-managed-hook` so subsequent re-runs recognise and replace
only VGuard-owned hooks (existing non-vguard hooks are left in place
unless the user passes `--force`).

The hook scripts exec `node_modules/.bin/vguard _run-git-hook <event>`,
which invokes the same `runGitHook()` path as manual CLI invocations.
No hidden behaviour, no network calls, no file writes outside
`.vguard/data/rule-hits.jsonl`. See
[`src/cli/commands/install-hooks.ts`](src/cli/commands/install-hooks.ts)
for the exact body templates and
[`src/engine/git-hook-runner.ts`](src/engine/git-hook-runner.ts) for
the runner.

**Escape hatches:**

- `VGUARD_SKIP_HOOKS=1 git commit …` — skip VGuard hooks for one
  commit without touching any files.
- `VGUARD_NO_INSTALL_HOOKS=1 npm install` — skip the `postinstall`
  auto-install entirely (e.g. hostile-repo linting).
- `vguard install-hooks --uninstall` — remove any hook this tool
  installed; non-vguard hooks at the same paths are left alone.

Installing vguard as a dependency runs `postinstall`, which in turn
runs `install-hooks --silent`. Like every npm package, this is a
trust decision at `npm install` time — the same trust model that
applies to `prepare`, `postinstall`, and `install` scripts in every
other dep in your lockfile.

### 4. Project-local rules

`.vguard/rules/custom/**/*.{ts,js,mjs}` are autoloaded at config
resolution time. They run the same way plugins do, except their
effective severity is capped at `warn` — block-severity enforcement
still requires a published plugin via `config.plugins`. Local rules are
authored by the same humans who author the repo, so we trust them to
run; we don't trust them to block developers without going through an
npm publish.

### 5. Cloud sync

When `cloud.enabled: true` is set, rule-hit payloads are streamed to
`https://vguard.dev` (or whatever `VGUARD_CLOUD_URL` points at, subject
to the allowlist in `src/cloud/url-guard.ts`). Payload contents are
rule-hit records, which can include `filePath` and rule `message`
fields. Before upload, VGuard:

- scrubs paths matching `.vguardignore` / `cloud.excludePaths`;
- redacts high-signal secret shapes (API keys, JWTs, PATs) in every
  string field — see `src/cloud/sync.ts#scrubSecretsDeep`.

Disable cloud sync and no network I/O happens for rule-hit data.

## Recommended mitigations

### For CI or any untrusted-input flow

- **Disable plugins entirely.** Set `VGUARD_NO_PLUGINS=1` in the CI
  environment. `src/plugins/loader.ts` short-circuits and no plugin
  module code executes. The built-in rule set still runs.

- **Prefer a JSON config** (`.vguardrc.json` or `package.json#vguard`)
  over `vguard.config.ts` when you are running against repos you didn't
  author. JSON is pure data; it cannot execute code the way a TS config
  can.

- **Pin and review plugin packages.** Plugins are published npm
  packages — treat them exactly like any other runtime dependency.
  Inspect before installing, pin versions, and audit updates.

- **Pin the cloud endpoint.** Leave `VGUARD_CLOUD_URL` /
  `VGUARD_FUNCTIONS_URL` unset unless you have a specific reason to
  override them. The allowlist in `src/cloud/url-guard.ts` already
  refuses arbitrary hosts, but not setting the variable at all removes
  the dial altogether.

### For local development

- Read `vguard.config.ts` before running a VGuard command on an
  unfamiliar repository, the same way you'd read `package.json#scripts`
  before running `npm run dev`.
- Prefer `vguard --help` for discovery; it does not load the config.
- `vguard init` writes a minimal config you can inspect.

## Environment variables that change behaviour

| Variable               | Effect                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `VGUARD_NO_PLUGINS=1`  | Skip loading any plugin module; built-in rules still run.                                        |
| `VGUARD_DEV=1`         | Allow `http://` / private-IP cloud URLs (see `src/cloud/url-guard.ts`). Never set in production. |
| `VGUARD_CLOUD_URL`     | Override the cloud API host. Must match the allowlist.                                           |
| `VGUARD_FUNCTIONS_URL` | Override the Supabase functions host. Must end with `.supabase.co`.                              |
| `VGUARD_API_KEY`       | Project API key for cloud sync (otherwise read from `~/.vguard/credentials.json`).               |

## Long-term hardening (not yet shipped)

The following are **not** currently implemented. They are named here so
the trust model is honest about what is and isn't covered:

- **Plugin sandboxing** via `node:vm` or a worker subprocess with
  capability flags.
- **Static analysis at plugin load time** that flags banned APIs
  (`child_process`, `fs.readFile` outside the project, `fetch` to
  non-vguard.dev hosts).
- **Allow-listed plugin registry** with published hashes, so
  `config.plugins` can reference a known-good set rather than arbitrary
  packages.
- **OS-keychain-backed credential storage** (today credentials live in
  `~/.vguard/credentials.json` with `0o600` mode / Windows ACL).

Track these via GitHub issues if you need them for a specific deploy.
