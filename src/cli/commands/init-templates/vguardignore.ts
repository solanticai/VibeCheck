/**
 * Default `.vguardignore` content created by `vguard init` and
 * `vguard ignore init`.
 *
 * Starts with a header + commented hints so users immediately
 * understand what the file is and what they can add to it.
 */

export const DEFAULT_VGUARDIGNORE = `# VGuard ignore — files and folders listed here are excluded from
# all vguard rules, hooks, and scans (vguard lint, runtime hooks,
# and vguard learn).
#
# Syntax mirrors .gitignore (https://git-scm.com/docs/gitignore):
#   node_modules/                 ignores everything in node_modules/
#   *.generated.ts                ignores all .generated.ts files anywhere
#   src/components/ui/**          ignores a specific directory tree
#   !src/components/ui/button.tsx re-includes a file
#
# These patterns are ADDITIVE on top of the built-in defaults
# (node_modules/, .next/, dist/, build/, .git/, coverage/, .vguard/,
# .turbo/, __pycache__/, .venv/). You do not need to re-list them.
#
# Tip: if you have patterns in your .gitignore you'd also like vguard
# to respect, copy the relevant lines here.

# Generated code
**/*.generated.ts
**/*.generated.js
**/*.min.js

# Type declaration files (emitted, not hand-written)
**/*.d.ts

# IDE / OS
.vscode/
.idea/
.DS_Store

# Common third-party / generated UI directories (uncomment if used)
# src/components/ui/
# packages/ui/

# Frozen SQL migrations (uncomment if your migrations are append-only)
# supabase/migrations/
# prisma/migrations/
# migrations/

# Fixtures / snapshots
# **/__snapshots__/
# **/fixtures/
`;
