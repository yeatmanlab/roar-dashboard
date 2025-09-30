// vite.config.js
import { sentryVitePlugin } from 'file:///home/david/levante/levante-dashboard/node_modules/@sentry/vite-plugin/dist/esm/index.mjs';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'file:///home/david/levante/levante-dashboard/node_modules/vite/dist/node/index.js';
import Vue from 'file:///home/david/levante/levante-dashboard/node_modules/@vitejs/plugin-vue/dist/index.mjs';
import mkcert from 'file:///home/david/levante/levante-dashboard/node_modules/vite-plugin-mkcert/dist/mkcert.mjs';
import { nodePolyfills } from 'file:///home/david/levante/levante-dashboard/node_modules/vite-plugin-node-polyfills/dist/index.js';
import UnheadVite from 'file:///home/david/levante/levante-dashboard/node_modules/@unhead/addons/dist/vite.mjs';
import * as child from 'child_process';
var __vite_injected_original_import_meta_url = 'file:///home/david/levante/levante-dashboard/vite.config.js';
var commitHash = child.execSync('git rev-parse --short HEAD').toString();
var vite_config_default = defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(commitHash),
    'import.meta.env.VITE_LEVANTE': JSON.stringify('TRUE'),
  },
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    nodePolyfills({
      globals: {
        process: true,
      },
    }),
    UnheadVite(),
    ...(process.env.VITE_HTTPS === 'TRUE' ? [mkcert()] : []),
    ...(process.env.NODE_ENV !== 'development'
      ? [
          sentryVitePlugin({
            org: 'roar-89588e380',
            project: 'dashboard',
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', __vite_injected_original_import_meta_url)),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
    https: process.env.VITE_HTTPS === 'TRUE',
  },
  build: {
    cssCodeSplit: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          lodash: ['lodash'],
          tanstack: ['@tanstack/vue-query'],
          chartJs: ['chart.js'],
          sentry: ['@sentry/browser', '@sentry/integrations', '@sentry/vue'],
          phoneme: ['@bdelab/roar-pa'],
          sre: ['@bdelab/roar-sre'],
          swr: ['@bdelab/roar-swr'],
          utils: ['@bdelab/roar-utils'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@levante-framework/firekit'],
    esbuildOptions: {
      mainFields: ['module', 'main'],
      resolveExtensions: ['.js', '.mjs', '.cjs'],
    },
  },
});
export { vite_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9kYXZpZC9sZXZhbnRlL2xldmFudGUtZGFzaGJvYXJkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9kYXZpZC9sZXZhbnRlL2xldmFudGUtZGFzaGJvYXJkL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL2RhdmlkL2xldmFudGUvbGV2YW50ZS1kYXNoYm9hcmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS92aXRlLXBsdWdpbic7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgVnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSc7XG5pbXBvcnQgbWtjZXJ0IGZyb20gJ3ZpdGUtcGx1Z2luLW1rY2VydCc7XG5pbXBvcnQgeyBub2RlUG9seWZpbGxzIH0gZnJvbSAndml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHMnO1xuaW1wb3J0IFVuaGVhZFZpdGUgZnJvbSAnQHVuaGVhZC9hZGRvbnMvdml0ZSc7XG5pbXBvcnQgKiBhcyBjaGlsZCBmcm9tICdjaGlsZF9wcm9jZXNzJztcblxuY29uc3QgY29tbWl0SGFzaCA9IGNoaWxkLmV4ZWNTeW5jKCdnaXQgcmV2LXBhcnNlIC0tc2hvcnQgSEVBRCcpLnRvU3RyaW5nKCk7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBkZWZpbmU6IHtcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBQX1ZFUlNJT04nOiBKU09OLnN0cmluZ2lmeShjb21taXRIYXNoKSxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfTEVWQU5URSc6IEpTT04uc3RyaW5naWZ5KCdUUlVFJyksXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICBWdWUoe1xuICAgICAgaW5jbHVkZTogWy9cXC52dWUkLywgL1xcLm1kJC9dLFxuICAgIH0pLFxuICAgIG5vZGVQb2x5ZmlsbHMoe1xuICAgICAgZ2xvYmFsczoge1xuICAgICAgICBwcm9jZXNzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICBVbmhlYWRWaXRlKCksXG4gICAgLi4uKHByb2Nlc3MuZW52LlZJVEVfSFRUUFMgPT09ICdUUlVFJyA/IFtta2NlcnQoKV0gOiBbXSksXG4gICAgLi4uKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnXG4gICAgICA/IFtcbiAgICAgICAgICBzZW50cnlWaXRlUGx1Z2luKHtcbiAgICAgICAgICAgIG9yZzogJ3JvYXItODk1ODhlMzgwJyxcbiAgICAgICAgICAgIHByb2plY3Q6ICdkYXNoYm9hcmQnLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgXSxcblxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgIH0sXG4gIH0sXG5cbiAgc2VydmVyOiB7XG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbJy4uJ10sXG4gICAgfSxcbiAgICBodHRwczogcHJvY2Vzcy5lbnYuVklURV9IVFRQUyA9PT0gJ1RSVUUnLFxuICB9LFxuXG4gIGJ1aWxkOiB7XG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgbG9kYXNoOiBbJ2xvZGFzaCddLFxuICAgICAgICAgIHRhbnN0YWNrOiBbJ0B0YW5zdGFjay92dWUtcXVlcnknXSxcbiAgICAgICAgICBjaGFydEpzOiBbJ2NoYXJ0LmpzJ10sXG4gICAgICAgICAgc2VudHJ5OiBbJ0BzZW50cnkvYnJvd3NlcicsICdAc2VudHJ5L2ludGVncmF0aW9ucycsICdAc2VudHJ5L3Z1ZSddLFxuICAgICAgICAgIHBob25lbWU6IFsnQGJkZWxhYi9yb2FyLXBhJ10sXG4gICAgICAgICAgc3JlOiBbJ0BiZGVsYWIvcm9hci1zcmUnXSxcbiAgICAgICAgICBzd3I6IFsnQGJkZWxhYi9yb2FyLXN3ciddLFxuICAgICAgICAgIHV0aWxzOiBbJ0BiZGVsYWIvcm9hci11dGlscyddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ0BsZXZhbnRlLWZyYW1ld29yay9maXJla2l0J10sXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgIG1haW5GaWVsZHM6IFsnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy5qcycsICcubWpzJywgJy5janMnXSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlTLFNBQVMsd0JBQXdCO0FBQ2xVLFNBQVMsZUFBZSxXQUFXO0FBQ25DLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUztBQUNoQixPQUFPLFlBQVk7QUFDbkIsU0FBUyxxQkFBcUI7QUFDOUIsT0FBTyxnQkFBZ0I7QUFDdkIsWUFBWSxXQUFXO0FBUDJKLElBQU0sMkNBQTJDO0FBU25PLElBQU0sYUFBbUIsZUFBUyw0QkFBNEIsRUFBRSxTQUFTO0FBR3pFLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFFBQVE7QUFBQSxJQUNOLG9DQUFvQyxLQUFLLFVBQVUsVUFBVTtBQUFBLElBQzdELGdDQUFnQyxLQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZEO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxJQUFJO0FBQUEsTUFDRixTQUFTLENBQUMsVUFBVSxPQUFPO0FBQUEsSUFDN0IsQ0FBQztBQUFBLElBQ0QsY0FBYztBQUFBLE1BQ1osU0FBUztBQUFBLFFBQ1AsU0FBUztBQUFBLE1BQ1g7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNELFdBQVc7QUFBQSxJQUNYLEdBQUksUUFBUSxJQUFJLGVBQWUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFBQSxJQUN0RCxHQUFJLFFBQVEsSUFBSSxhQUFhLGdCQUN6QjtBQUFBLE1BQ0UsaUJBQWlCO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDSCxJQUNBLENBQUM7QUFBQSxFQUNQO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLElBQ3REO0FBQUEsRUFDRjtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBLE1BQ0YsT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNkO0FBQUEsSUFDQSxPQUFPLFFBQVEsSUFBSSxlQUFlO0FBQUEsRUFDcEM7QUFBQSxFQUVBLE9BQU87QUFBQSxJQUNMLGNBQWM7QUFBQSxJQUNkLFdBQVc7QUFBQSxJQUNYLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLFFBQVEsQ0FBQyxRQUFRO0FBQUEsVUFDakIsVUFBVSxDQUFDLHFCQUFxQjtBQUFBLFVBQ2hDLFNBQVMsQ0FBQyxVQUFVO0FBQUEsVUFDcEIsUUFBUSxDQUFDLG1CQUFtQix3QkFBd0IsYUFBYTtBQUFBLFVBQ2pFLFNBQVMsQ0FBQyxpQkFBaUI7QUFBQSxVQUMzQixLQUFLLENBQUMsa0JBQWtCO0FBQUEsVUFDeEIsS0FBSyxDQUFDLGtCQUFrQjtBQUFBLFVBQ3hCLE9BQU8sQ0FBQyxvQkFBb0I7QUFBQSxRQUM5QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLDRCQUE0QjtBQUFBLElBQ3RDLGdCQUFnQjtBQUFBLE1BQ2QsWUFBWSxDQUFDLFVBQVUsTUFBTTtBQUFBLE1BQzdCLG1CQUFtQixDQUFDLE9BQU8sUUFBUSxNQUFNO0FBQUEsSUFDM0M7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
