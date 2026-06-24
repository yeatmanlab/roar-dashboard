import commonjs from "@rollup/plugin-commonjs";
import dsv from "@rollup/plugin-dsv";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { sentryRollupPlugin } from "@sentry/rollup-plugin";
import postcss from "rollup-plugin-postcss";
// eslint-disable-next-line import/no-extraneous-dependencies
import "dotenv/config";

// import pkg from "./package.json" assert { type: "json" };

export default {
  input: "src/experiment/index.js",
  plugins: [
    postcss({
      extract: "resources/roar-multichoice.css",
    }),
    dsv(),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    terser({
      compress: {
        drop_console: false,
      },
    }),
    commonjs(),
    sentryRollupPlugin({
      org: "roar-89588e380",
      project: "multichoice",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  output: [
    {
      dir: "lib",
      name: "@bdelab/roar-survey",
      entryFileNames: "[name].[hash].js",
      chunkFileNames: "[name].[hash].js",
      format: "es",
      sourcemap: true,
    },
  ],
};
