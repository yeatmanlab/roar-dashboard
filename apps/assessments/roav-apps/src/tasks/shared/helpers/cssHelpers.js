import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

export const setTaskClassCss = () => {
  const taskName = sessionGet(SK.NAME_TASK);
  document.body.classList.add(`${taskName}-body`);
};
