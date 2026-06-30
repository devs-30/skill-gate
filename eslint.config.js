'use strict';

// ESLint flat config (ESLint 9+). CommonJS to match the rest of the repo
// (no "type": "module" in package.json).
//
// Synced with Prettier: `eslint-config-prettier` is applied LAST so it switches
// off every ESLint rule that would conflict with Prettier's formatting. ESLint
// handles code-quality rules; Prettier owns all formatting. They never fight.

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  // Paths ESLint should never look at (editor cruft, local state, deps, the
  // plugin's runtime data dir). node_modules is ignored by default but listed
  // for clarity.
  {
    ignores: [
      'node_modules/**',
      '.git/**',
      '.idea/**',
      '.remember/**',
      '.claude/**',
      'skill-gate-debug.log',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow intentionally-unused args/vars prefixed with `_`.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Keep last: disables formatting rules that overlap with Prettier.
  prettier,
];
