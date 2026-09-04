import * as Sentry from "@sentry/browser";
import {
  captureConsoleIntegration,
  contextLinesIntegration,
  extraErrorDataIntegration,
} from "@sentry/integrations";

/**
 * Initialize Sentry for a ROAR assessment app.
 *
 * Call once per assessment from its `init()` method. Safe to call multiple times
 * in a session (e.g. during Cypress reruns) — subsequent calls are no-ops because
 * the Replay integration does not support multiple instances.
 *
 * @param {object} options
 * @param {string} options.dsn - Sentry DSN for the assessment's Sentry project.
 * @param {string} options.game - Full game slug used in Firebase Hosting preview URLs (e.g. 'roar-phoneme').
 * @param {string} options.gameShortened - Short game ID used in roar.education and staging URLs (e.g. 'pa').
 */
export function initSentry({ dsn, game, gameShortened }) {
  // Replay integration throws if initialized more than once in a session (e.g. during Cypress reruns).
  if (Sentry.getClient()) return;

  const regexRoarApp = new RegExp(
    `^https:\\/\\/${game}--pr\\d+-[\\w-]+\\.web\\.app\\/`,
  );
  const regexRoarStaging = new RegExp(
    `^https:\\/\\/roar-staging\\.web\\.app\\/game\\/${gameShortened}|https:\\/\\/roar-staging--pr\\d+-[\\w-]+\\.web\\.app\\/`,
  );

  Sentry.init({
    dsn,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
      Sentry.browserTracingIntegration(),
      captureConsoleIntegration({
        levels: ["warning", "error", "debug", "assert"],
      }),
      contextLinesIntegration(),
      extraErrorDataIntegration(),
    ],
    attachStacktrace: true,
    tracesSampleRate: 0.2,
    tracePropagationTargets: [
      regexRoarApp,
      regexRoarStaging,
      `https://roar.education/game/${gameShortened}`,
      "localhost",
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
