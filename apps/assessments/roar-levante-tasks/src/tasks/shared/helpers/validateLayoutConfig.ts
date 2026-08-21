import { camelize } from './camelize';

export const validateLayoutConfig = (
  layoutConfig: LayoutConfigType,
  mediaAssets: MediaAssetsType,
  translations: Record<string, string>,
  stimulus: StimulusType,
) => {
  const messages = [];
  if (layoutConfig.playAudioOnLoad) {
    // we expect audio file to be present
    if (!stimulus.audioFile) {
      messages.push('Missing audioFile string');
    } else {
      if (typeof stimulus.audioFile === 'string') {
        const audioAsset = camelize(stimulus.audioFile);
        if (!mediaAssets.audio[audioAsset]) {
          messages.push(`Missing audio asset: ${audioAsset}`);
        }
        if (layoutConfig.prompt.enabled && !translations[audioAsset]) {
          // check if prompt with translation is present
          messages.push(`Missing prompt for: ${audioAsset}`);
        }
      } else {
        const audioAssets = stimulus.audioFile.map((audio) => camelize(audio));
        audioAssets.forEach((audioAsset) => {
          if (!mediaAssets.audio[audioAsset]) {
            messages.push(`Missing audio asset: ${audioAsset}`);
          }
        });
      }
    }
  }

  if (layoutConfig.isImageButtonResponse) {
    // check if all images are present
    layoutConfig.response.values.forEach((c) => {
      const imageAsset = camelize(c);
      if (!imageAsset) {
        messages.push(`Missing image button string: ${imageAsset}`);
      }
      if (!mediaAssets.images[imageAsset]) {
        messages.push(`Missing imageAsset: ${imageAsset}`);
      }

      // staggered buttons
      if (layoutConfig.isStaggered && !mediaAssets.audio[imageAsset]) {
        // check if audio is present for all buttons
        messages.push(`Missing audio for staggered button: ${imageAsset}`);
      }
    });
  }

  return messages;
};
