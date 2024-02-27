import * as Sentry from '@sentry/vue'
import { captureConsoleIntegration, contextLinesIntegration, extraErrorDataIntegration } from '@sentry/integrations';

const regex = /https:\/\/roar-staging(--pr\d+-\w+)?\.web\.app/;

Sentry.init({
  dsn: "https://f15e3ff866394e93e00514b42113d03d@o4505913837420544.ingest.sentry.io/4506820782129152",
    release: `${process.env.npm_package_name}@${process.env.npm_package_version}`,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
      Sentry.browserTracingIntegration(),
      captureConsoleIntegration({
        levels: ['warning', 'error', 'debug', 'assert'],
      }),
      contextLinesIntegration(),
      extraErrorDataIntegration(),
    ],
    attachStacktrace: true,
    // Performance Monitoring
    tracesSampleRate: 0.2, // Capture 20% of the transactions
    tracePropagationTargets: [
      'localhost',
      'https://roar.education/',
      regex,
    ],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.

    beforeSend(event) {
      return event;
    },
});