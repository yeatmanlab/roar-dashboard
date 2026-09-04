import { camelize } from './camelize';

// function to filter a set of media assets to keep only those specified in images, audio and video arguments
export function filterMedia(startingAssets: MediaAssetsType, images: string[], audio: string[], video: string[]) {
  const finalAssets: MediaAssetsType = {
    images: {},
    audio: {},
    video: {},
  };

  ['images', 'audio', 'video'].forEach((string, index) => {
    const mediaType = string as 'images' | 'audio' | 'video';
    let assetNames = [images, audio, video][index];

    // make sure assets are camel case
    assetNames = assetNames.map((asset) => camelize(asset));

    finalAssets[mediaType] = Object.keys(startingAssets[mediaType])
      .filter((key) => assetNames.includes(camelize(key)))
      .reduce((acc: Record<string, string>, key) => {
        acc[key] = startingAssets[mediaType][key];
        return acc;
      }, {});
  });

  return finalAssets;
}
