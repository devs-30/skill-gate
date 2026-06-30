#!/usr/bin/env node
// PreToolUse hook for the Skill tool. Gates any skill listed in a per-project
// blocklist behind a confirmation prompt. Generalized port of the original
// ask-before-brainstorm hook: instead of hardcoding one skill, it reads the
// list of gated skills (and the mode) from a project config file.
//
// Config file (read live on every invocation -- no restart needed for edits):
//   <project>/.claude/skill-gate.json
//   {
//     "mode": "confirm" | "always" | "off",   // default: "confirm"
//     "blocked": ["superpowers:brainstorming", "my-skill", ...],
//     "debug": false                            // default: false
//   }
//
// Modes:
//   confirm  Custom 3-option prompt (YES / NO / NO+alternative) driven by the
//            model via AskUserQuestion. A one-shot, PER-SESSION + PER-SKILL
//            sentinel lets an approved invocation pass through on the retry.
//   always   Always show the native permission dialog (plain ask, every time).
//   off      Gating disabled; gated skills run without prompting.
//
// Debug:
//   When "debug" is true, the full decision flow of every invocation is appended
//   to <project>/skill-gate-debug.log (the repo root). Useful for understanding
//   exactly why a skill was (or wasn't) gated. The log file is created lazily.
//
// Fail-open everywhere: any error or missing config -> the skill runs.
'use strict';

const fs = require('fs');
const path = require('path');

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

// --- Read the hook payload from stdin. Any failure -> pass through. ---
let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  process.exit(0);
}

// --- Resolve the project dir and read the per-project config first, so debug
// logging can cover (almost) the entire flow. ---
const projectDir =
  process.env.CLAUDE_PROJECT_DIR ||
  (data && typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd());
const configPath = path.join(projectDir, '.claude', 'skill-gate.json');

let config = null;
let configError = null;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  configError = e && e.code === 'ENOENT' ? 'no config file' : String(e && e.message);
}

const mode =
  config && typeof config.mode === 'string' ? config.mode : 'confirm';
const blocked = Array.isArray(config && config.blocked) ? config.blocked : [];
const debug = !!(config && config.debug);

// --- Debug logger: buffer this invocation's lines, flush on exit. ---
const logBuf = [];
function log(msg) {
  if (debug) logBuf.push(msg);
}
function flushLog() {
  if (!debug || logBuf.length === 0) return;
  const logPath = path.join(projectDir, 'skill-gate-debug.log');
  const stamp = new Date().toISOString();
  const block =
    `\n===== skill-gate ${stamp} =====\n` +
    logBuf.map((l) => `  ${l}`).join('\n') +
    '\n';
  try {
    fs.appendFileSync(logPath, block);
  } catch {
    /* never let logging break the hook */
  }
}
// finish() is the single exit path so every branch flushes the log.
function finish(code, output) {
  if (output !== undefined) emit(output);
  flushLog();
  process.exit(code);
}

log(`session_id=${(data && data.session_id) || '(none)'}`);
log(`cwd=${(data && data.cwd) || '(none)'}  projectDir=${projectDir}`);
log(`configPath=${configPath}`);
log(
  configError
    ? `config=UNREADABLE (${configError}) -> fail-open`
    : `config: mode=${mode} debug=${debug} blocked=[${blocked.join(', ')}]`
);

// --- Resolve the invoked skill name from the Skill tool input. ---
const toolInput = data && data.tool_input != null ? data.tool_input : {};
const skillName =
  toolInput && typeof toolInput.skill === 'string' ? toolInput.skill.trim() : '';
log(`tool_input.skill=${JSON.stringify(skillName)}`);

if (!skillName) {
  log('decision=PASS (no identifiable skill name)');
  finish(0);
}

// No config (or unreadable) -> nothing is gated.
if (configError) {
  log('decision=PASS (no usable config)');
  finish(0);
}

// Is this skill gated? Exact match against the blocklist entries.
if (!blocked.includes(skillName)) {
  log('decision=PASS (skill not in blocklist)');
  finish(0);
}
log('gated=true (skill is in blocklist)');

if (mode === 'off') {
  log('decision=PASS (mode=off)');
  finish(0);
}

if (mode === 'always') {
  log('decision=ASK (mode=always, native permission dialog)');
  finish(0, {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Run the gated skill "${skillName}"?`,
    },
  });
}

// --- confirm mode (default) ---

// Sentinel scoped to BOTH session and skill name: an approval for one skill in
// one session never leaks into another skill or another session.
const rawSid =
  data && typeof data.session_id === 'string' && data.session_id
    ? data.session_id
    : 'nosession';
const sid = rawSid.replace(/[^A-Za-z0-9._-]/g, '_');
const skillSlug = skillName.replace(/[^A-Za-z0-9._-]/g, '_');
const sentinel = `/tmp/claude-skill-gate-approved.${sid}.${skillSlug}`;
log(`mode=confirm sentinel=${sentinel}`);

// Approved on the previous turn -> consume the sentinel and allow this run.
if (fs.existsSync(sentinel)) {
  let consumed = true;
  try {
    fs.unlinkSync(sentinel);
  } catch {
    consumed = false;
  }
  log(`sentinel exists -> decision=PASS (consumed=${consumed})`);
  finish(0);
}

// Not yet approved -> block and tell the model to ask with custom options.
log('sentinel absent -> decision=DENY (ask user via AskUserQuestion)');
const reason =
  `The skill "${skillName}" is gated by skill-gate. Do NOT invoke this skill ` +
  `directly again. Ask the user with the AskUserQuestion tool (header: ` +
  `'Skill gate') using exactly these options: 1) 'YES' = run the skill; ` +
  `2) 'NO' = do not run, stop; 3) 'NO - tell me what to do instead' = do not ` +
  `run, propose an alternative approach. If the user picks YES: run Bash ` +
  `'touch ${sentinel}' and then invoke the "${skillName}" skill again. ` +
  `For NO: stop. For the third option: do not run the skill, propose what to ` +
  `do instead.`;

finish(0, {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
});
