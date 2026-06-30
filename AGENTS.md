# AGENTS.md

Guidance for agents (and humans) working in this repo.

## Linting & formatting

ESLint (code quality) and Prettier (formatting) are configured to work together
without conflicts: `eslint-config-prettier` is applied last in the flat config,
so ESLint never reports on anything Prettier owns.

**After changing any code, run:**

```bash
npm run fix:all
```

This auto-fixes lint issues (`eslint . --fix`) and then formats every file
(`prettier --write .`). It is the single command to leave the tree clean.

### All scripts

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `npm run fix:all`      | Auto-fix lint issues, then format everything        |
| `npm run lint`         | Report ESLint problems (no changes)                 |
| `npm run lint:fix`     | Auto-fix ESLint problems                            |
| `npm run format`       | Format all files with Prettier                      |
| `npm run format:check` | Verify formatting without writing (CI-friendly)     |
| `npm run check`        | `lint` + `format:check` — read-only gate, no writes |

First-time setup: `npm install`.

### Config files

- `eslint.config.js` — ESLint 9 flat config, CommonJS, Node globals, ES2023.
- `.prettierrc.json` — single quotes, semicolons, trailing commas, 80 cols.
- `.prettierignore` / `ignores` in `eslint.config.js` — kept in sync; both skip
  `node_modules/`, `.idea/`, `.remember/`, `.claude/`, and `skill-gate-debug.log`.

Style baseline (matches the existing source): 2-space indent, single quotes,
semicolons, trailing commas, CommonJS (`require`/`module.exports`).

## Repo layout

- `hooks/` — the PreToolUse hook (`skill-gate-hook.js`) and its `hooks.json`.
- `scripts/` — helper scripts (e.g. `list-skills.js`).
- `skills/focus-guard/` — the skill that manages the gate blocklist.
- `.githooks/` — versioned git hooks; enable with `make setup-hooks`.

See `README.md` for what the plugin does and how to install it.
