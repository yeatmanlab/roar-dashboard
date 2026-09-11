import i18next from 'i18next';
import { generateAssetObject } from '@bdelab/roar-utils';

export const mediaAssets = {};

export const initMediaAssets = (assets, bucketURI) => {
  const mediaAssetsNew = generateAssetObject(assets, bucketURI, i18next.language);
  Object.assign(mediaAssets, mediaAssetsNew); // to keep binding for export
};
