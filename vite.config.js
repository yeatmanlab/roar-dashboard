import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import { ViteFaviconsPlugin } from "vite-plugin-favicon";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    ViteFaviconsPlugin("./src/assets/roar-icon.png"),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});