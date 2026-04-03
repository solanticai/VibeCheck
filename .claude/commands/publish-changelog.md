Publish a changelog discussion post to GitHub after a release.

This command creates a new post in the [Changelog discussions category](https://github.com/solanticai/vibe-guard/discussions/categories/changelog) summarizing all changes in a release.

## Steps

1. **Identify the release version:**
   ```bash
   git describe --tags --abbrev=0
   ```
   Or read from `package.json`:
   ```bash
   node -p "require('./package.json').version"
   ```

2. **Extract changelog content** for this version from `CHANGELOG.md`:
   - Read the section between `## [<version>]` and the next `## [` heading
   - This contains all Added, Changed, Fixed, Removed entries

3. **Get the commit diff** since the previous tag:
   ```bash
   git log --oneline $(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "HEAD~20")..HEAD
   ```

4. **Format the discussion post** using this structure:

   **Title:** `v<version> — <one-line summary>`

   **Body:**
   ```markdown
   # VGuard v<version>

   Released: <date>
   npm: `npm install @solanticai/vguard@<version>`

   ## What's New

   <changelog content from CHANGELOG.md>

   ## Commits

   <commit list>

   ---

   Full changelog: https://github.com/solanticai/vibe-guard/blob/master/CHANGELOG.md
   npm: https://www.npmjs.com/package/@solanticai/vguard/v/<version>
   ```

5. **Create the discussion:**
   ```bash
   gh api graphql -f query='
     mutation {
       createDiscussion(input: {
         repositoryId: "<repo-id>",
         categoryId: "<changelog-category-id>",
         title: "v<version> — <summary>",
         body: "<formatted body>"
       }) {
         discussion { url }
       }
     }
   '
   ```

   To get the IDs:
   ```bash
   gh api graphql -f query='{ repository(owner: "solanticai", name: "vibe-guard") { id, discussionCategories(first: 10) { nodes { id, name } } } }'
   ```

6. **Report the URL** of the created discussion to the user.

## Notes

- This is also automated in the publish workflow (`.github/workflows/publish.yml`)
- Use this command for manual changelog posts or to re-post after a failed automation
