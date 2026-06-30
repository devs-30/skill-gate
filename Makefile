.PHONY: setup-hooks version version-bump list-skills

# One-time: point git at the versioned .githooks/ directory. Enables the
# pre-push hook, which pushes version tags to the remote alongside their
# commits (it does NOT create tags - that is `version-bump`). Idempotent -
# re-run anytime (also after a fresh clone, since core.hooksPath is local git
# config and is not committed).
setup-hooks:
	git config core.hooksPath .githooks
	@echo "Git hooks configured: .githooks/"

# Preview the next version without changing anything (analyzes conventional
# commits since the last tag). No-op unless on main.
version:
	@.githooks/auto-version.sh --dry-run

# Bump the version now: write the new SemVer into .claude-plugin/plugin.json
# and package.json, commit it as "chore(release): vX.Y.Z", and tag that commit.
# Does not push - run `git push` afterwards (the pre-push hook sends the tag,
# and the Release workflow turns that tag into a GitHub Release with notes
# auto-generated from the commits). No-op unless on main.
version-bump:
	@.githooks/auto-version.sh

# List the skills visible in this project (user -> plugin -> project ->
# project-local), as JSON - the names usable in the gate blocklist.
list-skills:
	@node scripts/list-skills.js
