import { config as baseConfig } from "./index.js";
import tseslint from "typescript-eslint";
import globals from "globals";

export const config = [
  // Inherit base config
  ...baseConfig,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Node/Express backend TS files
  {
    files: ["**/src/**/*.{ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        ...globals.node,
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {},
  },
];
