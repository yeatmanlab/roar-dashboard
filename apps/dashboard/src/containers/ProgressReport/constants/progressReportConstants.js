/**
 * Progress Report Constants
 *
 * Constants used throughout the Progress Report container.
 */

export const REPORT_VIEWS = [
  { name: 'Progress Report', constant: true },
  { name: 'Score Report', constant: false },
];

export const PRIORITY_TASKS = ['swr', 'sre', 'pa'];

export const PROGRESS_STATUS = {
  OPTIONAL: {
    value: 'optional',
    icon: 'pi pi-question',
    severity: 'info',
    tag: 'Optional',
  },
  COMPLETED: {
    value: 'completed',
    icon: 'pi pi-check',
    severity: 'success',
    tag: 'Completed',
  },
  STARTED: {
    value: 'started',
    icon: 'pi pi-spinner-dotted',
    severity: 'warning',
    tag: 'Started',
  },
  ASSIGNED: {
    value: 'assigned',
    icon: 'pi pi-book',
    severity: 'danger',
    tag: 'Assigned',
  },
};

export const DEFAULT_ORDER_BY = [
  {
    order: '1',
    field: 'user.grade',
  },
  {
    order: '1',
    field: 'user.lastName',
  },
];

export const DISTRICT_ORDER_BY_PREFIX = {
  order: '1',
  field: 'user.schoolName',
};

export const DEFAULT_PAGE_LIMIT = 10;
