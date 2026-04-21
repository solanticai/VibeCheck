---
name: auto-configure
description: Auto-configure VGuard for any repo by dispatching parallel exploration agents and synthesising a custom vguard.config.ts with bespoke rules and presets. Use when the user says "auto-configure vguard", "set up vguard for this repo", "generate custom guardrails for this codebase", or "analyze this repo and configure vguard".
args: target_dir
---

# Auto-Configure VGuard

Given an arbitrary target repository, this skill (a) profiles the codebase in parallel via specialised exploration sub-agents, then (b) synthesises a custom `vguard.config.ts`, a bundle of repo-specific rules, and a human-readable report explaining every choice.

The skill is **orchestration-only** — it drives the existing VGuard CLI (`init`, `generate`, `doctor`, `lint`, `learn`) and writes plain files. No direct codebase modifications beyond the standard VGuard outputs and `.vguard/rules/custom/`.

## Prerequisites

- VGuard installed in the target project (`npm i -D @anthril/vguard`). If absent, run [setup-vguard](../setup-vguard/SKILL.md) first.
- Node ≥ 20, git repo, read access to all source files.

## Step 1 — Size the repo & detect stacks

Run these sequentially in the target directory:

```bash
git ls-files | wc -l                # total files
```

Read (if present) each of: `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Gemfile`, `composer.json`, `Cargo.toml`, `pom.xml`, `build.gradle.kts`, `.python-version`, `mix.exs`. Extract:

- Primary language(s)
- Framework signals: `next`, `nuxt`, `astro`, `svelte`, `sveltekit`, `remix`, `vue`, `react`, `react-native`, `expo`, `express`, `fastify`, `hono`, `nestjs`, `django`, `fastapi`, `laravel`, `rails`, `phoenix`, `trpc`, `prisma`, `drizzle`, `langchain`, `@modelcontextprotocol/sdk`, `zod`, `tailwindcss`
- Infra signals: `Dockerfile`, `*.tf`, `k8s/**/*.yaml`, `helm/`, `serverless.yml`

Also scan for `.mcp.json`, `.cursor/rules/**`, `CLAUDE.md`, `AGENTS.md` — existing agent config hints at intent.

## Step 2 — Pick parallel agent count

Based on file count:

| File count | Agents | Focus areas                                                               |
| ---------- | ------ | ------------------------------------------------------------------------- |
| `< 200`    | **2**  | security, quality                                                         |
| `200–2000` | **4**  | security, quality, workflow, framework-conventions                        |
| `> 2000`   | **6**  | security, quality, workflow, framework-conventions, testing, dependencies |

Override upward (+1) if `Dockerfile`/`terraform`/`k8s` manifests are present — add an `infra` agent.

## Step 3 — Dispatch parallel profile agents

Launch all selected agents in a **single message with parallel tool calls** (multiple Agent invocations in one response). Each agent receives:

- Path to the target repo root
- Its focus area (`security` | `quality` | `workflow` | `framework-conventions` | `testing` | `dependencies` | `infra`)
- The full prompt template at [`prompts/profile-agent.md`](prompts/profile-agent.md)
- The detected stack list from Step 1

Each agent returns a `ProfileReport` JSON object with:

```json
{
  "focusArea": "security",
  "detectedStack": ["nextjs-15", "supabase", "typescript-strict"],
  "conventions": [{ "pattern": "string", "confidence": 0.0, "evidence": ["path:line", "..."] }],
  "risks": [
    {
      "severity": "block|warn|info",
      "ruleRef": "security/xxx",
      "rationale": "string",
      "evidence": ["path:line"]
    }
  ],
  "suggestedPresets": ["nextjs-15", "typescript-strict"],
  "suggestedRules": {
    "security/branch-protection": { "enabled": true, "severity": "block" }
  },
  "customRuleIdeas": [
    {
      "id": "custom/project-specific-rule",
      "description": "string",
      "match": { "tools": ["Write"] },
      "events": ["PreToolUse"],
      "checkOutline": "regex or AST description"
    }
  ]
}
```

## Step 4 — Merge reports

The parent (you) consolidates all `ProfileReport`s:

1. **Dedupe presets**: take the union, drop obvious redundancy (e.g. `react-19` is implied by `nextjs-15` per the existing VGuard presets).
2. **Resolve rule-severity conflicts**: if two agents disagree, pick the **higher severity** (block > warn > info).
3. **Rank custom rule ideas by confidence × evidence count**. Keep the top N (default 5). Drop anything without ≥ 2 concrete evidence paths.
4. **Cross-check against built-in rules** by running `npx vguard rules --json` — do not generate a custom rule that duplicates a built-in.

## Step 5 — Synthesise `vguard.config.ts`

Use the synthesizer prompt at [`prompts/synthesizer.md`](prompts/synthesizer.md) to produce:

1. **`vguard.config.ts`** — exports `defineConfig` with `presets`, `rules` (overrides for any built-in rule severities the merge recommended), `agents` (default `['claude-code']` unless the repo shows Cursor/Codex artefacts), and `plugins` (empty unless the merge surfaced a clear use case like license-check).
2. **`.vguard/rules/custom/<id>.ts`** — one file per surviving custom rule, generated from [`templates/custom-rule.ts.tmpl`](templates/custom-rule.ts.tmpl). Use the existing VGuard promoter pattern as the canonical reference — the template is compatible with it.
3. **`.vguard/AUTO_CONFIG_REPORT.md`** — human-readable report explaining every preset picked, every severity override, every custom rule. Include confidence scores and evidence paths. This is the artefact a human reviews.

## Step 6 — Run `vguard generate`

```bash
npx vguard generate
```

This emits adapter files (hooks, `.claude/settings.json`, `.cursorrules`, `AGENTS.md`, etc.) based on the new config.

## Step 7 — Verify

Run all three:

```bash
npx vguard doctor      # health check; should report all green
npx vguard lint        # scans for violations of the new config
npx vguard rules       # confirms the set of active rules
```

If `doctor` reports red, surface the errors and pause — do not attempt to patch silently. If `lint` reports violations, that is expected (agents should fix those before merging).

## Step 8 — Hand-off

Tell the user:

1. Which presets were applied and why (link to `.vguard/AUTO_CONFIG_REPORT.md`).
2. How many custom rules were generated (path: `.vguard/rules/custom/`).
3. The `lint` baseline count (how many issues already exist).
4. One-sentence summary of the enforcement posture (e.g. "blocking on branch protection + secrets, warning on code quality").
5. That the user should review `.vguard/AUTO_CONFIG_REPORT.md` before committing `vguard.config.ts` — **this skill never commits**.

## Notes

- **Never run parallel tool calls sequentially.** Step 3 is one message with multiple `Agent` invocations. Sequencing them negates the performance benefit.
- **Respect `.gitignore` + `.vguardignore`** when walking the repo. The existing VGuard walker at `src/learn/walker.ts` is the reference implementation for file filtering.
- **Do not write outside `vguard.config.ts`, `.vguard/`, and the adapter outputs from `vguard generate`**. No source code mutations.
- **Custom rules start as `severity: 'info'`** unless the merge evidence justifies higher. Escalation is a human decision.
- If the repo has pre-existing `vguard.config.ts`, **do not overwrite** — emit to `vguard.config.auto.ts` and surface a diff in the report for human review.
