import * as Sentry from '@sentry/browser';
import { captureConsoleIntegration, contextLinesIntegration, extraErrorDataIntegration } from '@sentry/integrations';

const game = 'roar-swr';
const gameShortened = 'swr';
const regexRoarApp = new RegExp(`^https:\\/\\/${game}--pr\\d+-\\w+\\.web\\.app\\/`);
const regexRoarStaging = new RegExp(
  `^https:\\/\\/roar-staging\\.web\\.app\\/game\\/${gameShortened}|https:\\/\\/roar-staging--pr\\d+-\\w+\\.web\\.app\\/`,
);

export function initSentry() {
  Sentry.init({
    // Change dsn to the one for the app
    dsn: 'https://824c4c36b4dff88550ff5cc0a3de46e1@o4505913837420544.ingest.sentry.io/4505913888735232',
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
      regexRoarApp,
      regexRoarStaging,
      `https://roar.education/game/${gameShortened}`,
      'localhost',
    ],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.

    beforeSend(event) {
      return event;
    },
  });
}
