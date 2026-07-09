import commonjs from "@rollup/plugin-commonjs";
import dsv from "@rollup/plugin-dsv";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import postcss from "rollup-plugin-postcss";
import { sentryRollupPlugin } from "@sentry/rollup-plugin";

export default {
  input: "src/index.js",
  plugins: [
    postcss({
      extract: "resources/roam-apps.css",
    }),
    dsv(),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    terser(),
    commonjs(),
    sentryRollupPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "roar-89588e380",
      project: "roam",
    }),
  ],
  output: [
    {
      dir: "lib",
      name: "@bdelab/roam-apps",
      entryFileNames: "[name].[hash].js",
      chunkFileNames: "[name].[hash].js",
      format: "es",
      sourcemap: true,
    },
  ],
};
