---
name: sweep-gitignore
description: Audit a repo for files that should be ignored by git and produce a consolidated patch for .gitignore. Dispatches parallel category sub-agents (build artefacts, deps, IDE/OS cruft, secrets/env, logs/caches) and merges their findings into a dedup'd, evidence-backed proposal. Use when the user says "sweep gitignore", "audit gitignore", "what should I be ignoring", "clean up .gitignore", or "compile .gitignore entries".
args: target_dir
---

# Sweep .gitignore

Walk a repository, dispatch per-category exploration sub-agents in parallel, and emit a single `.gitignore` patch plus a human-readable report explaining every proposed entry.

The skill is **advisory**: it never modifies `.gitignore` directly. The user reviews the patch at `.vguard/GITIGNORE_SWEEP_REPORT.md` and decides whether to apply.

## Prerequisites

- Git repository (run from any path inside the worktree; detect root via `git rev-parse --show-toplevel`).
- Node ≥ 18 is assumed for any helper scripts; none are strictly required.

## Step 1 — Anchor the worktree

```bash
git rev-parse --show-toplevel
git ls-files | wc -l                 # total tracked files
git ls-files --others --exclude-standard | wc -l   # currently untracked + not-ignored
```

Record the repo root and the untracked-but-not-ignored count. The sweep's success metric is "does this number drop to ~zero after applying the patch?"

Read:

- `.gitignore` (root) — split into lines, strip comments, build a Set of existing patterns.
- Any nested `.gitignore` files under subdirs (find up to depth 4).
- `.git/info/exclude` if present (local-only ignores — for reference, don't propose duplicating them into `.gitignore`).
- `.gitattributes` (for context on EOL / binary handling — not a scope target, but informs the report).

## Step 2 — Pick parallel agent count

One sub-agent per category. Always dispatch **all six** — they're cheap because each agent runs a tight, focused walk.

| Category | Focus |
| --- | --- |
| `build-artefacts` | `dist/`, `build/`, `out/`, `.next/`, `.nuxt/`, `target/`, `bin/`, `obj/`, `*.tsbuildinfo`, `coverage/`, `*.lcov`, compiled outputs (`*.o`, `*.so`, `*.dll`, `*.exe`, `*.class`, `*.pyc`, `__pycache__/`) |
| `dependencies` | `node_modules/`, `bower_components/`, `vendor/`, `.pnp.*`, Python venvs (`venv/`, `.venv/`, `env/`), Rust `target/`, `.bundle/`, `Pods/`, `.gradle/` |
| `editor-ide` | `.vscode/*` (with allowlist for `.vscode/extensions.json` + `.vscode/settings.json`), `.idea/`, `*.swp`, `*.swo`, `*~`, `.project`, `.classpath`, `.settings/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `$RECYCLE.BIN/`, `ehthumbs.db`, `.Spotlight-V100`, `.Trashes`, `.history/` |
| `secrets-env` | `.env`, `.env.*` (with allowlist for `.env.example` / `.env.sample` / `.env.template`), `*.pem`, `*.key`, `*.pfx`, `*.p12`, `id_rsa`, `id_dsa`, `*.jks`, `*.keystore`, `.netrc`, `.aws/credentials`, `.npmrc` (user-level), `gha-creds-*.json`, `.terraform/` state |
| `logs-caches` | `*.log`, `npm-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`, `lerna-debug.log*`, `.cache/`, `.parcel-cache/`, `.turbo/`, `.eslintcache`, `.stylelintcache`, `.rpt2_cache/`, `.rts2_cache_*/`, `.tsc-cache/`, `.swc/`, `.webpack/`, `.rollup.cache/`, `.vercel/`, `.netlify/`, `.wrangler/` |
| `tool-local` | `.claude/settings.local.json`, `.cursor/`, `.aider*`, `.continue/`, `.opencode/sessions`, `.vguard/cache/`, `.vguard/learned/`, `.vguard/data/`, tool-generated scratch under `tmp/`, `.temp/`, `tempfiles/` |

If the repo is **not** a Node project, the agent for that category may return an empty list — that's fine.

## Step 3 — Dispatch parallel profile agents

Launch all six agents in a **single message with parallel tool calls**. Each agent receives:

- `repoRoot` — absolute path.
- `category` — one of the six from Step 2.
- `existingPatterns` — Set of lines already present in `.gitignore` (so agents don't propose duplicates).
- `trackedFiles` — `git ls-files` output (array of paths).
- `untrackedFiles` — `git ls-files --others --exclude-standard` output.
- The full prompt template at [`prompts/category-agent.md`](prompts/category-agent.md).

Each agent returns a `CategoryReport` JSON object with:

```json
{
  "category": "build-artefacts",
  "proposals": [
    {
      "pattern": "dist/",
      "rationale": "bundler output; 73 files under dist/ currently untracked",
      "evidence": ["dist/index.js", "dist/types.d.ts"],
      "severity": "high",
      "allowlistExceptions": []
    }
  ],
  "allowlistCandidates": [
    {
      "pattern": "!.env.example",
      "rationale": "public template that must stay tracked"
    }
  ],
  "alreadyTracked": [
    {
      "path": "src/.DS_Store",
      "action": "suggest git rm --cached",
      "reason": "OS cruft committed by mistake"
    }
  ]
}
```

Severity rubric:

- `critical` — secret or credential-shaped content actually in the tree (must be removed from history, not just ignored).
- `high` — bulky regenerable artefact or OS/tool cruft with ≥ 5 matching untracked files.
- `medium` — pattern that's idiomatic for the stack but doesn't currently have hits (preventive).
- `low` — personal-preference / rare-platform patterns.

## Step 4 — Merge reports

1. **Dedupe** — union all `proposals[].pattern`. If two agents propose overlapping patterns, pick the narrower one and attribute both rationales.
2. **Drop** any pattern that already appears in `existingPatterns` from Step 1 (agents should skip these, but defence in depth).
3. **Collate allowlist entries** — every `!pattern` must appear *after* its matching ignore pattern in the final ordering. Group by category block.
4. **Tracked-but-should-be-ignored list** — `alreadyTracked` entries surface as a manual-action section in the report; never auto-run `git rm --cached`.
5. **Secret findings** — any `critical` severity entry triggers an extra block at the top of the report with the literal text _"Secret material may already be in git history. Ignoring the file is not enough. Run `git log --all -- <path>` and consider `git filter-repo` / BFG."_

## Step 5 — Emit outputs

1. **`.vguard/GITIGNORE_SWEEP_REPORT.md`** — human-readable report. Structure:
   - Executive summary: N proposals, M allowlist entries, K tracked-should-be-ignored, secrets flag.
   - One table per category: `pattern | severity | rationale | evidence count | sample path`.
   - Dedicated "Apply this patch" block — a fenced code block with the exact lines to append to `.gitignore`, ordered by category with comment dividers matching the existing `.gitignore`'s style (detected from Step 1).
   - Manual-action list for `alreadyTracked` entries (one `git rm --cached …` per line, commented out so the user opts in).
2. **No direct edits to `.gitignore`** — the skill is advisory. If the user explicitly asks "apply it", run:

   ```bash
   # only after explicit user approval
   cat <<'PATCH' >> .gitignore

   # --- Added by ai-for-vibe-guard/sweep-gitignore on <date> ---
   <merged patch block>
   PATCH
   ```

   Never commit. The user commits.

## Step 6 — Verify

```bash
git status --short | wc -l           # untracked count after the proposed patch
git check-ignore -v <sample paths>   # sanity-check that new patterns match what we expect
```

Report the before / after untracked counts in the summary. If the `after` count is still high, surface the top 10 remaining untracked paths so the user can decide whether to extend the patch manually.

## Step 7 — Hand-off

Tell the user:

1. How many new patterns were proposed, broken down by severity.
2. Whether any secret-shaped content was found (and that history rewrite may be needed).
3. The before / after untracked-file counts.
4. The path to the report (`.vguard/GITIGNORE_SWEEP_REPORT.md`) and the location of the ready-to-paste patch inside it.
5. That this skill never wrote to `.gitignore` — the user reviews and applies.

## Notes

- **Never write outside `.vguard/GITIGNORE_SWEEP_REPORT.md`** unless the user explicitly requests `--apply`.
- **Respect existing `.gitignore` style** (comment style, blank-line grouping). If the existing file is empty, use category-header comments.
- **Never propose to ignore a currently-tracked file** without surfacing it in the `alreadyTracked` section — silent ignores of tracked files do nothing because git still tracks them.
- **Secret findings** are surfaced but never automated — `git rm --cached` is user-initiated only. History rewrites are categorically out of scope for this skill.
- **Scope**: root `.gitignore` only. Nested `.gitignore` files are read for context but not modified; the report notes when a nested ignore would be more appropriate.
