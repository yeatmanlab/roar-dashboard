import { config as baseConfig } from "./index.js";
import vue from "eslint-plugin-vue";
import cypress from "eslint-plugin-cypress";
import globals from "globals";

export const config = [
  ...baseConfig,
  ...vue.configs["flat/recommended"],

  // Resolve Vite alias '@' -> './src' for JS/Vue projects
  {
    files: ['**/*.{js,vue,mjs}'],
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.mjs', '.vue', '.json']
        },
      },
    },
  },

  // General frontend JS
  {
    files: ["**/src/**/*.js", "**/cypress/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly",
      },
    },
  },

  // Vue-specific config
  {
    files: ["**/src/**/*.vue"],
    plugins: { vue },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly", // @TODO: Remove and fix code.
      },
    },
    rules: {
      // TODO: Re-enable and fix violations of the following rules:
      "vue/max-attributes-per-line": "off",
      "vue/html-indent": "off",
      "vue/html-self-closing": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      // @TODO: End.

      "vue/multi-word-component-names": "off",
      "vue/no-undef-components": [
        "error",
        {
          ignorePatterns: [
            "AppSpinner",
            "GMapAutocomplete", // vue-google-maps-community-fork
            "i18n-t", // vue-i18n
            "router-link", // vue-router
            "router-view", // vue-router
          ],
        },
      ],
    },
  },

  // Cypress-specific config
  cypress.configs.recommended,
  {
    files: ["**/cypress/**/*.cy.js", "**/cypress/**/*.js"],
    plugins: { cypress },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // @TODO: Re-enable and fix violations of the following rules
      "cypress/no-unnecessary-waiting": "warn",
      "cypress/unsafe-to-chain-command": "warn",
    },
  },

  // Cypress config
  {
    files: ['**/cypress.config.cjs'],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        process: "readonly",
        __dirname: "readonly",
      },
    },
  },

  // Vite and Vitest configs
  {
    files: ["**/vite.config.js", "**/vitest.config.js", "**/vitest.setup.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        process: "readonly",
        __dirname: "readonly",
      },
    },
  },
];
