import { createPreloadTrials } from '@bdelab/roar-utils';
import i18next from 'i18next';

export const t_preloadTrials = {};

export const initPreloadTrials = (assets, bucketURI) => {
  const preloadTrials = createPreloadTrials(assets, bucketURI, i18next.language).default;
  preloadTrials.message = i18next.t('loading');
  Object.assign(t_preloadTrials, preloadTrials);
};
