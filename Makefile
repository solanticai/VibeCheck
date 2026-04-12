# =============================================================================
# VGuard — Contributor Sync
# =============================================================================
# Fetches contributor lists from all Anthril repos (vibe-guard,
# vibe-guard-cloud) via the GitHub CLI, then merges them into a single
# deduplicated JSON file at .github/data/all-contributors.json.
#
# Requirements: gh (GitHub CLI, authenticated), python3
#
# Usage:
#   make contributors              Fetch & merge from all repos
#   make contributors.vibe-guard   Fetch from a single repo
# =============================================================================

ORG := Anthril
REPOS := vibe-guard vibe-guard-cloud
OUT_DIR := .github/data

help:
	@echo ""
	@echo "SCRIPTS"
	@echo ""
	@echo "  make contributors        # fetch contributors from all repos"
	@echo "  make contributors.REPO   # fetch contributors from a single repo"
	@echo ""

# Ensure output directory exists
$(OUT_DIR):
	mkdir -p $(OUT_DIR)

# Fetch contributors for a single repo
contributors.%: | $(OUT_DIR)
	@echo "Fetching contributors for $(ORG)/$*..."
	@gh api --paginate "repos/$(ORG)/$*/contributors" \
		--jq '[.[] | {username: .login, avatar_url: .avatar_url, contributions: .contributions}] | sort_by(.username)' \
		> $(OUT_DIR)/$*-contributors.json
	@echo "  Saved $(OUT_DIR)/$*-contributors.json"

# Fetch all repos then merge into a deduplicated list
.PHONY: contributors
contributors: $(addprefix contributors., $(REPOS))
	@echo "Merging contributors..."
	@python3 -c "\
	import json, glob, os; \
	seen = {}; \
	files = glob.glob(os.path.join('$(OUT_DIR)', '*-contributors.json')); \
	[seen.update({c['username']: c for c in json.load(open(f))}) for f in files]; \
	merged = sorted(seen.values(), key=lambda c: c['username'].lower()); \
	json.dump(merged, open(os.path.join('$(OUT_DIR)', 'all-contributors.json'), 'w'), indent=2); \
	print(f'  {len(merged)} unique contributors saved to $(OUT_DIR)/all-contributors.json')"
