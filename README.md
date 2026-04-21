<div align="center">

# VGuard

**AI coding guardrails that actually enforce.**

[![npm version](https://img.shields.io/npm/v/@anthril/vguard?color=2563EB&label=npm)](https://www.npmjs.com/package/@anthril/vguard)
[![npm downloads](https://img.shields.io/npm/dm/@anthril/vguard?color=2563EB)](https://www.npmjs.com/package/@anthril/vguard)
[![license](https://img.shields.io/github/license/anthril/vibe-guard?color=2563EB)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/anthril/vibe-guard/ci.yml?label=CI&color=16A34A)](https://github.com/anthril/vibe-guard/actions)
[![node](https://img.shields.io/badge/node-%3E%3D20-16A34A)](package.json)

</div>

---

AI coding tools write code fast, but they also introduce security vulnerabilities, break project conventions, and push to protected branches. VGuard sits between the AI tool and your codebase, checking every proposed change before it happens. Bad changes get blocked with a clear explanation and a suggested fix. Good changes pass through without friction.

<img src="docs/assets/architecture-flow.svg" alt="VGuard architecture flow: Developer Prompt → AI Agent → VGuard → Pass or Block" width="100%" />

## Quick Start

```bash
npm install -D @anthril/vguard
npx vguard init
```

Answer four questions and you have working guardrails. The init wizard detects your framework, asks which AI tools you use, and generates everything. See the full [Getting Started](https://vguard.dev/docs/getting-started) guide.

## Features

**Runtime Enforcement** — Claude Code hooks run before every tool call. VGuard inspects the proposed change, evaluates it against your rules, and blocks anything that violates them. The AI agent sees exactly what went wrong and how to fix it. [Adapter docs →](https://vguard.dev/docs/adapters/claude-code)

**Advisory Guidance** — Cursor, Codex, and OpenCode don't support runtime hooks, so VGuard generates configuration files that teach the AI your project's rules before it starts writing. [Agent setup →](https://vguard.dev/docs/agent-setup)

**Smart Detection** — Edit rules only flag problems that are newly introduced. Pre-existing issues in the file are left alone so you can adopt guardrails incrementally without fixing every legacy violation first. [Rules overview →](https://vguard.dev/docs/rules/overview)

## Rule Layers

<img src="docs/assets/rule-layers.svg" alt="Five rule layers: Security, Quality, Workflow, Custom, Analytics" width="100%" />

### Rules — 25 built-in

| Category     | Count | Examples                                                              | Docs                                                     |
| ------------ | ----: | --------------------------------------------------------------------- | -------------------------------------------------------- |
| **Security** |     7 | branch-protection, secret-detection, prompt-injection, rls-required   | [security rules](https://vguard.dev/docs/rules/security) |
| **Quality**  |    11 | import-aliases, naming-conventions, hallucination-guard, dead-exports | [quality rules](https://vguard.dev/docs/rules/quality)   |
| **Workflow** |     7 | commit-conventions, pr-reminder, migration-safety, changelog-reminder | [workflow rules](https://vguard.dev/docs/rules/workflow) |

### Presets — 14 ecosystem presets

nextjs-15 · react-19 · typescript-strict · supabase · tailwind · django · fastapi · laravel · wordpress · react-native · astro · sveltekit · python-strict · go

[Browse all presets →](https://vguard.dev/docs/presets)

### Agent Support

<img src="docs/assets/agent-support.svg" alt="Agent support: Claude Code (runtime), Cursor/Codex/OpenCode (advisory), GitHub Actions (CI)" width="100%" />

## Documentation

| Section                                                     | Description                                   |
| ----------------------------------------------------------- | --------------------------------------------- |
| [Getting Started](https://vguard.dev/docs/getting-started)  | Install, init wizard, first run               |
| [Configuration](https://vguard.dev/docs/configuration)      | `vguard.config.ts` reference                  |
| [CLI](https://vguard.dev/docs/cli)                          | `init`, `add`, `remove`, `generate`, `doctor` |
| [Rules](https://vguard.dev/docs/rules/overview)             | All built-in rules with examples              |
| [Presets](https://vguard.dev/docs/presets)                  | Framework-specific rule bundles               |
| [Agent Setup](https://vguard.dev/docs/agent-setup)          | Per-agent adapter configuration               |
| [Custom Rules](https://vguard.dev/docs/guides/custom-rules) | Write your own guardrails                     |
| [Troubleshooting](https://vguard.dev/docs/troubleshooting)  | Common issues and fixes                       |

## Exit codes

VGuard follows the BSD `sysexits.h` conventions so CI scripts can branch on specific failure modes. The mapping is stable across the major version and lives in [`src/cli/exit-codes.ts`](src/cli/exit-codes.ts).

| Code  | Name            | When                                                                                          |
| ----- | --------------- | --------------------------------------------------------------------------------------------- |
| `0`   | `OK`            | Success.                                                                                      |
| `2`   | `USAGE`         | Unknown flag, missing required argument, invalid `--format` choice, `--check` + `--apply`.    |
| `3`   | `LINT_BLOCKING` | `vguard lint` found one or more `block`-severity issues.                                      |
| `65`  | `DATA_ERR`      | Config file loaded but failed validation (malformed JSON / zod parse error).                  |
| `66`  | `NO_INPUT`      | Expected config not found (e.g. any command needing `vguard.config.ts` before `vguard init`). |
| `69`  | `UNAVAILABLE`   | Cloud API or network dependency unreachable.                                                  |
| `70`  | `SOFTWARE`      | Unexpected internal error. `--debug` reveals the stack trace.                                 |
| `77`  | `NO_PERM`       | Not logged in, 401/403 from Cloud, missing API key.                                           |
| `78`  | `CONFIG`        | `vguard doctor` ran all checks and at least one failed (or warned with `--strict`).           |
| `130` | `SIGINT`        | Ctrl+C — interactive prompts and long-running commands both honour this.                      |

Example CI gate:

```bash
vguard doctor --strict
case $? in
  0)  echo "healthy" ;;
  66) echo "run 'vguard init' first" ;;
  78) echo "config or hooks broken - blocking deploy"; exit 1 ;;
  *)  exit 1 ;;
esac
```

## Terminal behaviour

VGuard plays nicely with pipes, CI, and accessibility tooling out of the box:

| Variable / flag                | Effect                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `NO_COLOR=1` (env)             | Disable all ANSI colour output. Follows the [no-color.org](https://no-color.org) standard.                     |
| `--no-color`                   | Same as `NO_COLOR=1` for a single invocation.                                                                  |
| `--ascii`                      | Replace Unicode glyphs (`●`, `✓`, `✗`) with ASCII equivalents (`*`, `[ok]`, `[fail]`). Useful on `LANG=C`.     |
| `-q` / `--quiet`               | Suppress banners, progress spinners, and summaries. Machine output on stdout is unaffected.                    |
| `--verbose`                    | Emit extra diagnostic detail on stderr.                                                                        |
| `--debug` (or `DEBUG=vguard*`) | Show full stack traces on error instead of the friendly one-line message.                                      |
| `CI=true` (env, auto-detected) | Disables interactive prompts; commands fall back to defaults or `--yes`-style flags.                           |
| stdout not a TTY               | Auto-disables colour, spinners, and the `vguard` no-args setup hint — safe for `vguard cmd \| jq .` pipelines. |

`vguard` already auto-detects non-TTY stdout, so you rarely need to set any of these manually.

## VGuard Cloud

[VGuard Cloud](https://vguard.dev) gives your team a dashboard for AI coding activity — which rules fire most, who's triggering blocks, and how conventions drift over time. Set up drift alerts, connect webhooks, and export analytics. Free tier available for small teams.

[Cloud docs →](https://vguard.dev/docs/cloud-integration) · [Sign up →](https://vguard.dev)

## Sponsors

This project is maintained by [Anthril](https://github.com/anthril) and funded by our sponsors.

[Become a sponsor →](https://github.com/sponsors/anthril)

<!-- sponsors --><!-- sponsors -->

## Community

- [GitHub Discussions](https://github.com/anthril/vibe-guard/discussions)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Trust Model](TRUST_MODEL.md) — what `vguard` commands actually execute, and how to lock it down in CI
- [Changelog](CHANGELOG.md)

## License

[Apache 2.0](LICENSE) — Anthril
