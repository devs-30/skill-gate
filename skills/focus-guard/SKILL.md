---
name: focus-guard
description: Use when the user wants to gate, block, restrict, guard, or require confirmation before specific skills run, or to manage which skills are gated. Triggers on "block a skill", "gate brainstorming", "require confirmation before skill X", "add/remove a skill to the gate", "stop skill X from auto-running", "skill guardrail", "focus guard", "skill-gate". Sets up and edits the per-project blocklist that the skill-gate PreToolUse hook enforces.
---

# Focus Guard

Manage which skills are **gated** in this project. A gated skill is intercepted
by the skill-gate plugin's PreToolUse hook before it runs and (in the default
`confirm` mode) blocked until the user explicitly approves it via a YES / NO /
NO+alternative prompt. This is the generalized version of the original "ask
before brainstorming" hook.

## How the pieces fit

- **The hook** (`${CLAUDE_PLUGIN_ROOT}/hooks/skill-gate-hook.js`) ships with this
  plugin and runs on every `Skill` tool call. It is active whenever the
  `skill-gate` plugin is enabled. You do not create it — enabling the plugin is
  what "creates the hook".
- **The blocklist** lives per project at `<project>/.claude/skill-gate.json`.
  The hook reads it **live on every call**, so adding/removing a skill takes
  effect immediately — no restart needed. (Only enabling the plugin itself needs
  a restart.)

Config shape:

```json
{
  "mode": "confirm",
  "blocked": ["superpowers:brainstorming", "some-other-skill"],
  "debug": false
}
```

- `mode`: `"confirm"` (default — YES/NO/alternative prompt), `"always"` (native
  permission dialog every time), or `"off"` (disable gating without losing the list).
- `blocked`: exact skill identifiers as the Skill tool uses them — bare name for
  personal skills (`my-skill`), `plugin:skill` for plugin skills.
- `debug`: `false` (default). When `true`, the hook appends the full decision
  flow of every Skill invocation to `<project>/skill-gate-debug.log` (the repo
  root) — config read, resolved skill name, blocklist match, mode branch,
  sentinel state, and final decision. Useful for diagnosing why a skill was or
  wasn't gated.

## Workflow

Pick the branch that matches the request.

### Adding skills to the gate

1. **Discover available skills** by hierarchy (user → plugin → project →
   project-local). Run the helper:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/list-skills.js"
   ```
   It prints `{ "skills": [ { name, tier, description, source } ] }`. Reconcile
   with the skills you can actually see available in this session — the helper
   covers filesystem skills; your in-context list is the authoritative set of
   what is invocable here. Prefer the union, deduped by `name`.
2. **Read the current config** at `<project>/.claude/skill-gate.json` (treat a
   missing file as `{ "mode": "confirm", "blocked": [] }`). Exclude already-blocked
   skills from the candidates.
3. **Ask the user which to gate** with AskUserQuestion (`multiSelect: true`),
   grouping/labeling options by tier so the source is clear. Do not invent skills
   not in the discovered list.
4. **Write the config**: merge the chosen identifiers into `blocked` (dedup,
   keep sorted), preserve `mode`, and create the file (and `.claude/` dir) if
   absent. Use exact identifiers from step 1.
5. **Confirm** what is now gated and remind the user it takes effect immediately.

### Removing skills from the gate

1. Read `<project>/.claude/skill-gate.json`. If missing or `blocked` is empty,
   tell the user nothing is gated and stop.
2. Ask with AskUserQuestion (`multiSelect: true`) which of the **currently
   blocked** entries to remove.
3. Write the config back with those entries removed.
4. Confirm the new state.

### Changing the mode or disabling

- To pause gating without losing the list, set `mode` to `"off"`.
- To switch to the native permission dialog, set `mode` to `"always"`.
- To re-enable the custom prompt, set `mode` to `"confirm"`.
  Edit only the `mode` field; leave `blocked` untouched.

### Toggling debug logging

- When the user asks to debug the gate / log the hook flow / "turn on debug",
  set `"debug": true` in the config (leave `mode` and `blocked` untouched).
- Tell the user the log is written to `<project>/skill-gate-debug.log` (repo
  root) and that each Skill invocation appends one block. It takes effect
  immediately — no restart.
- Suggest gitignoring `skill-gate-debug.log` so the log isn't committed.
- To stop logging, set `"debug": false` (and optionally delete the log file).

### Listing the current state

Read and show `mode` plus the `blocked` entries (with tiers from the helper when
useful). If the file is missing, say gating is not configured yet for this project.

## Rules

- Identifiers in `blocked` must match exactly what the Skill tool passes (the
  helper's `name` field is already in that form). A mismatch silently fails to gate.
- Never add a skill the user did not choose. Always confirm via AskUserQuestion
  before writing.
- The config is per project. Do not write to `~/.claude` — the hook is global,
  the list is local by design.
- Keep `blocked` sorted and deduplicated when writing.
- This skill does not need to (and must not) edit `~/.claude/settings.json` or
  the hook script; it only manages `<project>/.claude/skill-gate.json`.
