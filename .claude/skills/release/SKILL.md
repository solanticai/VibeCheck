---
name: release
description: "Full release process: version bump, changelog, quality checks, PR, CI monitoring, and changelog discussion covering both vibe-guard and vibe-guard-cloud."
---

# VGuard Release Process

Automate the full release lifecycle for VGuard. This skill replaces the manual release and publish-changelog commands.

## Prerequisites

- Working directory is `C:/Development/vibe-guard`
- On the `dev` branch with a clean working tree (or changes ready to include)
- GitHub CLI (`gh`) authenticated
- npm registry accessible

## Step 1: Determine Version Bump

1. Read the current version:
   ```bash
   node -p "require('./package.json').version"
   ```

2. Check the latest published version:
   ```bash
   npm view @anthril/vguard version
   ```

3. Review commits since last tag:
   ```bash
   git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD
   ```

4. Auto-detect bump type from conventional commits:
   - Any commit with `BREAKING CHANGE` footer or `!` suffix → **major**
   - Any `feat:` or `feat(…):` commit → **minor**
   - Only `fix:`, `chore:`, `docs:`, etc. → **patch**

5. **Ask the user to confirm or override** the version bump before proceeding.

## Step 2: Update package.json

Edit the `"version"` field in `package.json` to the new version.

## Step 3: Update CHANGELOG.md

1. Read the current `CHANGELOG.md`
2. Under `## [Unreleased]`, insert a new section:
   ```
   ## [X.Y.Z] - YYYY-MM-DD
   ```
3. Group commits by type:
   - **Added** — `feat:` commits
   - **Changed** — `refactor:`, `chore:` commits
   - **Fixed** — `fix:` commits
   - **Removed** — anything that removes functionality
4. Clear the `## [Unreleased]` section content (keep the heading)
5. Follow the existing format in the file (Keep a Changelog specification)

## Step 4: Run Quality Checks

Run each check sequentially. If any fail, read the error output, fix the issue, and re-run. Maximum 3 attempts per check before stopping.

```bash
npm run lint
npm run format -- --check
npm run type-check
npm test
npm run build
```

If you fix code to pass checks, include those fixes in the commit.

## Step 5: Audit README, TRUST_MODEL, and SECURITY

Before committing the release, verify the three top-level docs still match reality. Each release can ship new rules, presets, adapters, CLI commands, plugin surface, or supported version lines — stale docs here mislead users and auditors.

Run this check for each file:

### 5a. `README.md`

1. **Rule counts** — compare the table against source:
   ```bash
   for dir in src/rules/*/; do
     n=$(ls "$dir" 2>/dev/null | grep -v index.ts | grep -v helpers | wc -l)
     echo "$dir: $n"
   done
   ```
   Update the "Rules — N built-in across M categories" heading and every row of the category table.

2. **Preset count and list** — `ls src/presets/*.ts | grep -v index.ts | wc -l` and compare against the Presets section. Group changes into the existing sub-buckets (Frontend, Backend, Data/APIs, AI/Infra, Language strictness) or add a new one if warranted.

3. **Adapter count** — `ls -d src/adapters/*/ | wc -l` and compare against the "Agent Support — N adapters" table.

4. **CLI command list** — `grep -E "^\s*\.command\(" src/cli/index.ts` and compare against the CLI row in the Documentation table.

5. **Exit codes** — cross-check against `src/cli/exit-codes.ts`; add any new ones.

6. **Features** — if a release adds a headline capability (learning, drift, cloud, plugin surface, new adapter mode), add a short `**Name** — one line` bullet in the Features section.

7. **Companion skills** — if this release added or removed any skill under `ai-for-vibe-guard/skills/`, verify the count and list anywhere they are referenced (README, CLAUDE.md, docs). If a new skill landed, confirm it is included in the `files` array in `package.json` so it ships with the tarball (`npm pack --dry-run | grep ai-for-vibe-guard`).

### 5b. `TRUST_MODEL.md`

1. Re-read the document end-to-end.
2. Flag any of these that changed in this release:
   - new surface that executes user-authored code (config, plugins, hook scripts, templates)
   - new network egress (cloud endpoints, webhooks, telemetry)
   - new filesystem writes outside `.vguard/`
   - new environment variables that disable safety checks
   - new `SECURITY DEFINER`-equivalent behaviour (elevated privileges, root-only operations)
3. If any changed, add or update the relevant numbered section. Keep the "equivalent to `npm run <script>`" framing intact.

### 5c. `SECURITY.md`

1. **Supported Versions table** — compare against `package.json` version. The table must list the current major with a checkmark, and downgrade older majors per the 90-day policy.
2. **Reporting channel** — confirm `security@anthril.com` (or current channel) still applies.
3. **Triage SLAs and disclosure window** — leave untouched unless the user has asked to change them.

### 5d. Stage doc updates

Any changes made above are part of this release commit. Stage them alongside `package.json` and `CHANGELOG.md` in Step 6.

If no changes are needed, say so explicitly to the user (one line: "README, TRUST_MODEL, SECURITY all current.") and continue.

## Step 6: Stage, Commit, Push

```bash
git add package.json CHANGELOG.md README.md TRUST_MODEL.md SECURITY.md
# Also add any files fixed in Step 4
git commit -m "chore(release): bump version to X.Y.Z"
git push origin dev
```

**Safety rules:**
- Never force-push
- Never modify master directly
- All operations on `dev` branch only

## Step 7: Create PR

```bash
gh pr create --base master --head dev \
  --title "chore(release): vX.Y.Z" \
  --body "$(cat <<'EOF'
## Release vX.Y.Z

### Changes

<paste changelog excerpt here>

### Checklist

- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] All checks passing
EOF
)"
```

Report the PR URL to the user.

## Step 8: Monitor CI

```bash
gh pr checks <PR_NUMBER> --watch
```

If checks fail:
1. Read the failed check logs: `gh run view <RUN_ID> --log-failed`
2. Fix the issue
3. Push the fix to `dev`
4. Wait for checks again

**Maximum 2 retry cycles.** If checks still fail after 2 retries, stop and ask the user for guidance.

## Step 9: Publish Changelog Discussion (Post-Merge)

**This step runs AFTER the user confirms the PR has been merged and the publish workflow has completed.**

1. Wait for user confirmation that the PR is merged and npm publish succeeded.

2. Get the version and tag:
   ```bash
   VERSION=$(node -p "require('./package.json').version")
   TAG="v$VERSION"
   ```

3. Extract changelog content for this version from `CHANGELOG.md` (the section between `## [X.Y.Z]` and the next `## [`).

4. Get commits since previous tag:
   ```bash
   PREV_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")
   git log --oneline "$PREV_TAG"..HEAD
   ```

5. Check vibe-guard-cloud for recent changes:
   ```bash
   cd C:/Development/vibe-guard-cloud
   git log --oneline --since="2 weeks ago" --no-merges
   cd C:/Development/vibe-guard
   ```

6. Build the discussion body covering BOTH repos:
   ```markdown
   # VGuard vX.Y.Z

   **Released:** YYYY-MM-DD
   **Install:** `npm install @anthril/vguard@X.Y.Z`

   ## What's Changed

   <changelog content from CHANGELOG.md>

   ## Cloud Updates

   <summary of vibe-guard-cloud changes, or "No cloud changes in this release." if none>

   ## Commits

   ```
   <commit list>
   ```

   ---

   **Full changelog:** https://github.com/anthril/vibe-guard/blob/master/CHANGELOG.md
   **npm:** https://www.npmjs.com/package/@anthril/vguard/v/X.Y.Z
   **Release:** https://github.com/anthril/vibe-guard/releases/tag/vX.Y.Z
   ```

7. Get repository and changelog category IDs:
   ```bash
   gh api graphql -f query='{ repository(owner: "anthril", name: "vibe-guard") { id, discussionCategories(first: 20) { nodes { id, name } } } }'
   ```

8. Create the discussion:
   ```bash
   gh api graphql -f query='
     mutation {
       createDiscussion(input: {
         repositoryId: "<REPO_ID>",
         categoryId: "<CHANGELOG_CATEGORY_ID>",
         title: "vX.Y.Z — <one-line summary>",
         body: "<formatted body>"
       }) {
         discussion { url }
       }
     }
   '
   ```

9. Report the discussion URL to the user.

## Step 10: Audit vibe-guard-cloud Documentation

After each release, check whether the cloud documentation needs updates:

1. **Compare rule counts** — Get the total rule count and categories from vibe-guard source:
   ```bash
   cd C:/Development/vibe-guard
   ls src/rules/*/index.ts | wc -l  # Count categories
   grep -r "registerRule" src/rules/ | wc -l  # Count rules
   ```

2. **Check docs overview** — Read `C:/Development/vibe-guard-cloud/src/content/docs/rules/overview.md` and verify:
   - Total rule count matches actual count
   - All categories are listed
   - No missing rule category pages

3. **Check for missing doc pages** — Compare rule category directories against doc files:
   ```bash
   # Rule categories in source
   ls C:/Development/vibe-guard/src/rules/
   # Doc pages that exist
   ls C:/Development/vibe-guard-cloud/src/content/docs/rules/
   ```
   If a category exists in source but has no matching doc page, create one following the format of existing pages.

4. **Check sidebar navigation** — Verify `C:/Development/vibe-guard-cloud/src/app/(public)/docs/layout.tsx` lists all rule category pages in the `NAV_ORDER` Rules section.

5. **Check CLI reference** — If new CLI commands were added, verify `C:/Development/vibe-guard-cloud/src/components/dashboard/CLIReferenceDialog.tsx` includes them.

6. **Commit and push** any docs updates to vibe-guard-cloud:
   ```bash
   cd C:/Development/vibe-guard-cloud
   git add src/content/docs/ src/app/ src/components/
   git commit -m "docs: update for vX.Y.Z release"
   git push origin master
   ```

## Error Handling

- **Never force-push** or modify master directly
- **All git operations on dev branch only**
- **Stop and ask** the user after 2 CI failure retries
- **Confirm version bump** with user before proceeding
- If any step fails unexpectedly, report the error and ask for guidance
