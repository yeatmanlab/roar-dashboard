import * as Sentry from '@sentry/vue';
import { captureConsoleIntegration, contextLinesIntegration, extraErrorDataIntegration } from '@sentry/integrations';
import { i18n, languageOptions } from './translations/i18n';
import { isLevante } from '@/helpers';

// Workaround for using i18n-vue in plain JavaScript; this is a temporary solution until a more robust bug report component is implemented
const language = i18n.global.locale.value;

export function initSentry(app) {
  // skip if levante instance
  let dsn;
  let regex;
  let tracePropagationTargets;
  if (isLevante) {
    dsn = 'https://9d67b24a405feffb49477ca8002cc033@o4507250485035008.ingest.us.sentry.io/4507376476618752';
    regex = /https:\/\/hs-levante-admin-dev(--pr\d+-\w+)?\.web\.app/;
    tracePropagationTargets = ['https://hs-levante-admin-prod.web.app/**/*', 'https://hs-levante-admin-dev.web.app/**/*', regex];
  } else {
    dsn = 'https://f15e3ff866394e93e00514b42113d03d@o4505913837420544.ingest.us.sentry.io/4506820782129152';
    regex = /https:\/\/roar-staging(--pr\d+-\w+)?\.web\.app/;
    tracePropagationTargets = ['localhost:5173', 'https://roar.education/**/*', regex];
  }
  // Only initialize Sentry in production
  if (true) { // process.env.NODE_ENV === 'production'
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
          formTitle: languageOptions[language].translations.sentryForm.formTitle,
          buttonLabel: languageOptions[language].translations.sentryForm.buttonLabel,
          cancelButtonLabel: languageOptions[language].translations.sentryForm.cancelButtonLabel,
          submitButtonLabel: languageOptions[language].translations.sentryForm.submitButtonLabel,
          namePlaceholder: languageOptions[language].translations.sentryForm.namePlaceholder,
          emailPlaceholder: languageOptions[language].translations.sentryForm.emailPlaceholder,
          messageLabel: languageOptions[language].translations.sentryForm.messageLabel,
          messagePlaceholder: languageOptions[language].translations.sentryForm.messagePlaceholder,
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
  }
}
