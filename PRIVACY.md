# Privacy Policy — skill-gate

_Last updated: 2026-07-06_

**skill-gate** is a Claude Code plugin that runs entirely on your own machine. It
does **not** collect, transmit, sell, or share any personal data.

## What the plugin does with data

- **Configuration** — The plugin reads a per-project file at
  `<project>/.claude/skill-gate.json` to decide which skills are gated. This file
  lives on your machine and is never sent anywhere.
- **Debug log (opt-in)** — When `debug` is set to `true`, the plugin appends its
  decision flow to a local `<project>/skill-gate-debug.log` file. This file stays
  on your machine. Debug logging is **off by default**.

## What the plugin does NOT do

- No data is sent to the author, to Anthropic, or to any third party by this plugin.
- No analytics, telemetry, tracking, or network requests are made by the plugin.
- No personal information is collected or stored beyond the local files above.

## Third parties

skill-gate operates within Claude Code. Your use of Claude Code itself is governed
by Anthropic's own privacy policy and terms, which are independent of this plugin.

## Contact

Questions about this policy: **freetools@devs30.com**
