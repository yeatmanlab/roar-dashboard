import * as Sentry from '@sentry/vue';
import { captureConsoleIntegration, contextLinesIntegration, extraErrorDataIntegration } from '@sentry/integrations';
import { formattedLocale, languageOptions } from './translations/i18n';
import { isLevante } from '@/helpers';
import { App } from 'vue';

const language = formattedLocale;

export function initSentry(app: App) {
  // skip if levante instance
  let dsn: string;
  let regex: RegExp;
  let tracePropagationTargets;
  if (isLevante) {
    dsn = 'https://458fd3b1207c12df79f554b94f22833f@o4507250485035008.ingest.us.sentry.io/4508480347832320';
    regex = /https:\/\/hs-levante-admin-dev(--pr\d+-\w+)?\.web\.app/;
    tracePropagationTargets = ['https://hs-levante-admin-prod.web.app/**/*', 'https://hs-levante-admin-dev.web.app/**/*', regex];
  } else {
    dsn = 'https://f15e3ff866394e93e00514b42113d03d@o4505913837420544.ingest.us.sentry.io/4506820782129152';
    regex = /https:\/\/roar-staging(--pr\d+-\w+)?\.web\.app/;
    tracePropagationTargets = ['localhost:5173', 'https://roar.education/**/*', regex];
  }

  Sentry.init({
    app,
    dsn: dsn,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
      Sentry.browserTracingIntegration(),
      captureConsoleIntegration({
        levels: ['error'],
      }),
      Sentry.feedbackIntegration({
        showBranding: false,
        showName: false,
        showEmail: false,
        colorScheme: 'light',
        formTitle: languageOptions[language]?.translations?.sentryForm?.formTitle || 'Report a bug',
        buttonLabel: languageOptions[language]?.translations?.sentryForm?.buttonLabel || 'Submit',
        cancelButtonLabel: languageOptions[language]?.translations?.sentryForm?.cancelButtonLabel || 'Cancel',
        submitButtonLabel: languageOptions[language]?.translations?.sentryForm?.submitButtonLabel || 'Submit',
        namePlaceholder: languageOptions[language]?.translations?.sentryForm?.namePlaceholder || 'Name',
        emailPlaceholder: languageOptions[language]?.translations?.sentryForm?.emailPlaceholder || 'Email',
        messageLabel: languageOptions[language]?.translations?.sentryForm?.messageLabel || 'Message',
        messagePlaceholder: languageOptions[language]?.translations?.sentryForm?.messagePlaceholder || 'Message',
      }),
      contextLinesIntegration(),
      extraErrorDataIntegration(),
    ],
    attachStacktrace: true,
    // Performance Monitoring
    tracesSampleRate: 0.2, // Capture 20% of the transactions
    tracePropagationTargets: tracePropagationTargets,
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });

  Sentry.setTag('commitSHA', import.meta.env.VITE_APP_VERSION);
}
