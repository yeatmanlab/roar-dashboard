function combineMediaType(sources: MediaAssetsType[], mediaType: 'audio' | 'images' | 'video') {
  const singleTypeMedia: Record<string, string> = {};

  for (let i = 0; i < sources.length; i++) {
    Object.keys(sources[i][mediaType]).forEach((key) => {
      singleTypeMedia[key] = sources[i][mediaType][key];
    });
  }

  return singleTypeMedia;
}

export function combineMediaAssets(sources: MediaAssetsType[]) {
  const combinedMediaAssets: MediaAssetsType = {
    images: {},
    audio: {},
    video: {},
  };

  combinedMediaAssets.audio = combineMediaType(sources, 'audio');
  combinedMediaAssets.images = combineMediaType(sources, 'images');
  combinedMediaAssets.video = combineMediaType(sources, 'video');

  return combinedMediaAssets;
}

/**
 * function combineMediaType(
    mediaAssets: MediaAssetsType, 
    sharedMediaAssets: MediaAssetsType, 
    mediaType: 'audio' | 'images' | 'video'
) {
    Object.keys(sharedMediaAssets[mediaType]).forEach((key) => {
        mediaAssets[mediaType][key] = sharedMediaAssets[mediaType][key]; 
    });

    return mediaAssets[mediaType];
}

export function combineMediaAssets(
    mediaAssets: MediaAssetsType, 
    sharedMediaAssets: MediaAssetsType
) {
    mediaAssets.audio = combineMediaType(mediaAssets, sharedMediaAssets, 'audio');
    mediaAssets.images = combineMediaType(mediaAssets, sharedMediaAssets, 'images');
    mediaAssets.video = combineMediaType(mediaAssets, sharedMediaAssets, 'video');

    return mediaAssets; 
}

 */
