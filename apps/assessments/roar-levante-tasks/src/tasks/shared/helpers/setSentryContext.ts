import { setContext } from '@sentry/browser';
export type SentryContextType = {
  itemId: string;
  taskName: string;
  pageContext: string;
};

export const setSentryContext = (context: SentryContextType) => {
  setContext('ROARContext', context);
};
