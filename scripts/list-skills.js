#!/usr/bin/env node
// Enumerate skills available in the current project, following Claude Code's
// discovery hierarchy. Prints JSON to stdout:
//
//   { "skills": [ { "name", "tier", "description", "source" }, ... ] }
//
// `name` is the exact identifier the Skill tool uses (bare name for personal
// skills, "plugin:skill" for plugin skills) -- i.e. what goes in the blocklist.
//
// Tiers, in increasing precedence (later overrides earlier on name collision):
//   user          ~/.claude/skills/<name>/SKILL.md
//   plugin        skills shipped by enabled plugins (namespaced plugin:skill)
//   project       <project>/.claude/skills/<name>/SKILL.md
//   project-local <project>/.claude/skills.local/<name>/SKILL.md (if present)
//
// Best-effort and fail-soft: unreadable locations are skipped silently.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Parse the first `name:` / `description:` from YAML frontmatter, fail-soft.
function readFrontmatter(skillFile) {
  let text = '';
  try {
    text = fs.readFileSync(skillFile, 'utf8');
  } catch {
    return {};
  }
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const block = m ? m[1] : text.slice(0, 2000);
  const grab = (key) => {
    const r = block.match(new RegExp('^' + key + '\\s*:\\s*(.+)$', 'mi'));
    if (!r) return undefined;
    return r[1].trim().replace(/^["']|["']$/g, '');
  };
  return { name: grab('name'), description: grab('description') };
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

// Personal skills: a directory of <name>/SKILL.md, identifier = dir name.
function collectPersonal(skillsRoot, tier, out) {
  for (const name of listDirs(skillsRoot)) {
    const skillFile = path.join(skillsRoot, name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const fm = readFrontmatter(skillFile);
    out.push({
      name,
      tier,
      description: fm.description || '',
      source: skillFile,
    });
  }
}

// Plugin skills: identifier = "<pluginName>:<skillName>". Only enabled plugins.
function enabledPluginNames() {
  const set = new Set();
  for (const settings of [
    path.join(HOME, '.claude', 'settings.json'),
    path.join(PROJECT_DIR, '.claude', 'settings.json'),
    path.join(PROJECT_DIR, '.claude', 'settings.local.json'),
  ]) {
    try {
      const json = JSON.parse(fs.readFileSync(settings, 'utf8'));
      const ep = json && json.enabledPlugins;
      if (ep && typeof ep === 'object') {
        for (const [key, val] of Object.entries(ep)) {
          if (val) set.add(key.split('@')[0]); // "plugin@marketplace" -> "plugin"
        }
      }
    } catch {
      /* skip */
    }
  }
  return set;
}

function collectPlugins(out) {
  const enabled = enabledPluginNames();
  const roots = [
    path.join(HOME, '.claude', 'plugins', 'cache'),
    path.join(HOME, '.claude', 'plugins', 'marketplaces'),
  ];
  const seen = new Set();
  // Walk shallowly looking for ".../<pluginName>/skills/<skillName>/SKILL.md".
  function walk(dir, depth) {
    if (depth > 6) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      if (e.name === 'skills') {
        // Layouts vary: ".../<plugin>/skills" (marketplaces) and
        // ".../<plugin>/<version>/skills" (cache). Derive the plugin name as the
        // rightmost ancestor segment that is an enabled plugin; this also filters
        // out disabled plugins and collapses multiple cached versions.
        const segs = dir.split(path.sep);
        let pluginName = null;
        for (let i = segs.length - 1; i >= 0; i--) {
          if (enabled.has(segs[i])) {
            pluginName = segs[i];
            break;
          }
        }
        if (!pluginName) {
          if (enabled.size) continue; // enabled list known, no match -> skip
          pluginName = path.basename(dir); // unknown -> best effort
        }
        for (const skillName of listDirs(full)) {
          const skillFile = path.join(full, skillName, 'SKILL.md');
          if (!fs.existsSync(skillFile)) continue;
          const id = `${pluginName}:${skillName}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const fm = readFrontmatter(skillFile);
          out.push({
            name: id,
            tier: 'plugin',
            description: fm.description || '',
            source: skillFile,
          });
        }
      } else {
        walk(full, depth + 1);
      }
    }
  }
  for (const root of roots) walk(root, 0);
}

const collected = [];
collectPersonal(path.join(HOME, '.claude', 'skills'), 'user', collected);
collectPlugins(collected);
collectPersonal(
  path.join(PROJECT_DIR, '.claude', 'skills'),
  'project',
  collected,
);
collectPersonal(
  path.join(PROJECT_DIR, '.claude', 'skills.local'),
  'project-local',
  collected,
);

// Dedup by name, keeping the highest-precedence tier.
const PRECEDENCE = { user: 0, plugin: 1, project: 2, 'project-local': 3 };
const byName = new Map();
for (const s of collected) {
  const prev = byName.get(s.name);
  if (!prev || PRECEDENCE[s.tier] >= PRECEDENCE[prev.tier])
    byName.set(s.name, s);
}

const skills = [...byName.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
process.stdout.write(JSON.stringify({ skills }, null, 2) + '\n');
