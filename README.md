# skill-gate

A Claude Code plugin that **gates selected skills behind a confirmation prompt**.
A per-project blocklist decides which skills are intercepted, and a bundled skill
manages that list.

## What it does

- Ships a `PreToolUse` hook on the `Skill` tool. When a gated skill is invoked,
  the hook (in default `confirm` mode) blocks it and asks the model to confirm
  with the user via a **YES / NO / NO+alternative** prompt. A per-session,
  per-skill sentinel lets an approved run pass through on the immediate retry.
- Provides the `focus-guard` skill to **add/remove** skills from the gate and to
  switch modes. The candidate list is built from skills discovered across the
  user → plugin → project → project-local hierarchy.

## Install

This repo doubles as a single-plugin marketplace (namespace `devs-30`).

1. Add the marketplace:

   ```
   /plugin marketplace add devs-30/skill-gate
   ```

2. Install the plugin:

   ```
   /plugin install skill-gate@devs-30
   ```

`devs-30/skill-gate` is the GitHub `<owner>/<repo>`.

Restart Claude Code so the hook loads. The bundled skill and hook are then active.

## Usage

Ask in natural language, e.g.:

- "gate the brainstorming skill in this project"
- "use focus-guard to add a skill to the gate" / "add a skill to the gate"
- "remove X from the skill gate"
- "turn off the skill gate but keep the list"

The skill discovers available skills, asks which to gate (multi-select), and
writes the per-project config.

## Config

Per-project file, read live by the hook on every call (edits take effect
immediately — only enabling the plugin needs a restart):

`<project>/.claude/skill-gate.json`

```json
{
  "mode": "confirm",
  "blocked": ["superpowers:brainstorming"],
  "debug": false
}
```

- `mode`: `confirm` (custom YES/NO/alternative prompt — default), `always`
  (native permission dialog every time), `off` (disable, keep the list).
- `blocked`: exact Skill identifiers — bare name for personal skills,
  `plugin:skill` for plugin skills.
- `debug`: when `true`, the hook appends the full decision flow of every Skill
  invocation to `<project>/skill-gate-debug.log` (repo root) — config read,
  resolved skill name, blocklist match, mode branch, sentinel state, and final
  decision. Gitignore `skill-gate-debug.log` so it isn't committed.

## Layout

```
skill-gate/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json            # registers the PreToolUse(Skill) hook
│   └── skill-gate-hook.js    # generic gate: reads the per-project blocklist
├── scripts/
│   └── list-skills.js        # enumerate skills by discovery hierarchy
└── skills/
    └── focus-guard/
        └── SKILL.md          # manage the blocklist (add/remove/mode)
```
