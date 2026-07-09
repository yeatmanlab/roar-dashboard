import commonjs from "@rollup/plugin-commonjs";
import postcss from "rollup-plugin-postcss";
import dsv from "@rollup/plugin-dsv";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { sentryRollupPlugin } from "@sentry/rollup-plugin";
import OMT from "@surma/rollup-plugin-off-main-thread";
// eslint-disable-next-line import/no-extraneous-dependencies
import "dotenv/config";
// eslint-disable-next-line import/no-extraneous-dependencies
import html from "@rollup/plugin-html";
// eslint-disable-next-line import/no-extraneous-dependencies
import { string } from "rollup-plugin-string";
import { wasm } from "@rollup/plugin-wasm";
import copy from "rollup-plugin-copy";
import url from "@rollup/plugin-url";

export default {
  input: "src/experiment/index.js",
  plugins: [
    postcss({
      extract: "resources/roav-ran.css",
    }),
    OMT(),
    wasm(),
    url({
      include: "**/*.wasm",
      limit: 0, // Always emits files
    }),
    dsv(),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    terser(),
    commonjs({
      include: "node_modules/**", // This line is important to handle packages from node_modules
    }),
    sentryRollupPlugin({
      org: "roar-89588e380",
      project: "ran",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    //   These Rollup plugins are used to bundle HTML files into the output.
    html(),
    string({
      include: "**/*.html",
    }),
    copy({
      targets: [
        { src: "node_modules/onnxruntime-web/dist/*.wasm", dest: "lib" },
        {
          src: "src/experiment/views/eyetracking_google.onnx",
          dest: "lib/views",
        },
      ],
    }),
  ],
  output: [
    {
      dir: "lib",
      name: "@bdelab/roav-ran",
      entryFileNames: "[name].[hash].js",
      chunkFileNames: "[name].[hash].js",
      format: "es",
      sourcemap: true,
    },
  ],
};
