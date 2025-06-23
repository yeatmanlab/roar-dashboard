import { addBreadcrumb } from '@sentry/vue';

export const logBreadcrumb = ({ category, data, message, level = 'info' }) => {
  addBreadcrumb({
    category,
    data,
    level,
    message,
    timestamp: new Date(),
  });
};
