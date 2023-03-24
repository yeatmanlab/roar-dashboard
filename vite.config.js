import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import { ViteFaviconsPlugin } from "vite-plugin-favicon";
import Vue from "@vitejs/plugin-vue";
import Markdown from "vite-plugin-vue-markdown";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Markdown(),
    ViteFaviconsPlugin("./src/assets/roar-icon.png"),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
});