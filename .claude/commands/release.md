Guide through the VGuard release process.

## Steps

1. **Check current state:**
   ```bash
   git status
   git log --oneline dev..HEAD
   npm view @solanticai/vguard version
   ```

2. **Verify all checks pass:**
   ```bash
   npm run type-check && npm run lint && npm test && npm run build
   ```

3. **Determine version bump:**
   - Review commits since last release to determine: `patch`, `minor`, or `major`
   - `feat:` commits → minor bump
   - `fix:` commits → patch bump
   - Breaking changes (`!` suffix or `BREAKING CHANGE` footer) → major bump

4. **Update version in `package.json`**

5. **Update `CHANGELOG.md`:**
   - Add a new version section with date
   - Group changes by type: Added, Changed, Fixed, Removed
   - Reference PR numbers where applicable

6. **Commit the release:**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): bump version to <version>"
   ```

7. **Create PR to dev**, then after merge to dev, create PR from dev to master

## Publishing

Publishing is automated via GitHub Actions. When a PR is merged to `master`:
- The `publish.yml` workflow checks if the version is new
- If new, it publishes to npm via OIDC (no stored tokens)
- Creates a GitHub release with the tag `v<version>`
