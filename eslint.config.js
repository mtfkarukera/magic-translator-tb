import globals from "globals";

export default [
  {
    // ── Fichiers ciblés ──────────────────────────────────────────────────
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",

      // Globales disponibles dans le contexte Thunderbird WebExtension
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        browser: "readonly",
        messenger: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        fetch: "readonly",
      },
    },

    rules: {
      // ── Erreurs potentielles ──────────────────────────────────────────
      "no-undef": "error",
      "no-unused-vars": ["warn", { vars: "all", args: "after-used", argsIgnorePattern: "^_" }],
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-constant-condition": "warn",
      "no-empty": ["warn", { allowEmptyCatch: false }],
      "no-extra-semi": "error",

      // ── Bonnes pratiques ─────────────────────────────────────────────
      "eqeqeq": ["warn", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
      "no-throw-literal": "warn",
      "no-self-assign": "error",
      "no-self-compare": "warn",
      "no-useless-return": "warn",

      // ── Style ────────────────────────────────────────────────────────
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { max: 2 }],
      "semi": ["warn", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    // ── Ignorer les fichiers non pertinents ────────────────────────────
    ignores: [
      "node_modules/",
      "test/",
      "*.xpi",
      "eslint.config.js",
    ],
  },
];
