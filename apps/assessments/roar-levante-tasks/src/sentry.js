import { init, replayIntegration, browserTracingIntegration } from '@sentry/browser';
import { captureConsoleIntegration, contextLinesIntegration, extraErrorDataIntegration } from '@sentry/integrations';

const regexRoarApp = new RegExp('^https:\\/\\/roar-levante-tasks--pr\\d+-\\w+\\.web\\.app\\/');
const regexRoarStaging = new RegExp(
  `^https:\\/\\/gse-roar-admin-staging\\.web\\.app\\/game\\/core-tasks|https:\\/\\/roar-staging--pr\\d+-\\w+\\.web\\.app\\/`,
);

export function initSentry() {
  init({
    dsn: 'https://80b25aba46b9210279fa831982692c41@o4505913837420544.ingest.us.sentry.io/4509570973171713',
    integrations: [
      replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
      browserTracingIntegration(),
      captureConsoleIntegration({
        levels: ['error'],
      }),
      contextLinesIntegration(),
      extraErrorDataIntegration(),
    ],
    attachStacktrace: true,
    // Performance Monitoring
    tracesSampleRate: 0.2, //  Capture 20% of the transactions
    tracePropagationTargets: [regexRoarApp, regexRoarStaging, 'https://roar.education/game/core-tasks', 'localhost'],
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      return event;
    },
  });
}
