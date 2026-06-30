.PHONY: setup-hooks version version-bump list-skills

# One-time: point git at the versioned .githooks/ directory. Enables the
# pre-push hook, which auto-tags SemVer from conventional commits on main and
# pushes the tag. Idempotent - re-run anytime (also after a fresh clone, since
# core.hooksPath is local git config and is not committed).
setup-hooks:
	git config core.hooksPath .githooks
	@echo "Git hooks configured: .githooks/"

# Preview the next version tag without creating it (analyzes conventional
# commits since the last tag). No-op unless on main.
version:
	@.githooks/auto-version.sh --dry-run

# Create the next version tag now (without pushing). Normally the pre-push hook
# does this automatically; use this to tag manually. No-op unless on main.
version-bump:
	@.githooks/auto-version.sh

# List the skills visible in this project (user -> plugin -> project ->
# project-local), as JSON - the names usable in the gate blocklist.
list-skills:
	@node scripts/list-skills.js
