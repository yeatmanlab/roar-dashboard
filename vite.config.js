import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import vitePluginFaviconsInject from 'vite-plugin-favicons-inject';
import Vue from "@vitejs/plugin-vue";
import Markdown from "vite-plugin-vue-markdown";
import basicSsl from '@vitejs/plugin-basic-ssl'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Markdown(),
    vitePluginFaviconsInject("./src/assets/roar-icon.svg"),
    basicSsl(),
    nodePolyfills({
      globals: {
        process: true
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    cssCodeSplit: false
  },
  optimizeDeps: {
    include: [
      '@bdelab/roar-firekit',
      "vue-google-maps-community-fork",
      "fast-deep-equal",
    ],
  },
});