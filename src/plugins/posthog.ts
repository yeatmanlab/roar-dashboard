import posthog from 'posthog-js';
import type { App, Plugin } from 'vue';

interface PostHogPlugin {
  install: (app: App, options: { apiKey: string; host: string }) => void;
}

interface PostHogMock {
  identify: (...args: any[]) => void;
  capture: (...args: any[]) => void;
  reset: () => void;
  // Add other PostHog methods you might use if needed
}

const posthogKey = 'phc_td8viDO0LP7PZsn7nZrV9bJBYgEMSHE9WeVTlW2CGh5';
const posthogHost = 'https://us.i.posthog.com';

let posthogInstance: typeof posthog | PostHogMock;

if (posthogKey) { // Can be later conditioned to environment
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false, // We will capture pageviews manually using the router
    autocapture: false, // Disable autocapture for now, can be enabled later if needed
    capture_heatmaps: false,
  });
  posthogInstance = posthog;
  console.log('PostHog initialized');
} else {
  posthogInstance = {
    identify: (...args: unknown[]) => console.info('PostHog Identify:', ...args),
    capture: (...args: unknown[]) => console.info('PostHog Capture:', ...args),
    reset: () => console.info('PostHog Reset'),
    // Add mock implementations for other methods if you use them
  };
  console.info('PostHog mock initialized for development/non-production.');
  if (!posthogKey) {
    console.warn('VITE_POSTHOG_KEY environment variable not set.');
  }
}

export const PostHogPlugin: Plugin = {
  install: (app: App) => {
    app.config.globalProperties.$posthog = posthogInstance;
    app.provide('posthog', posthogInstance);
  },
};

export default posthogInstance; 