import { camelize } from './camelize';
import { combineMediaAssets } from './combineMediaAssets';
import { filterMedia } from './filterMedia';

export function batchMediaAssets(
  mediaAssets: MediaAssetsType,
  batchList: StimulusType[][],
  imageFields: string[], // fields of corpus where image assets are specified (varies by task)
  audioFields: string[] = ['audioFile'],
) {
  // organize media assets by block
  const batchedMediaAssets: MediaAssetsType[] = [];

  // list names of all assets found in particular block of corpus
  const batchedAssetNames: {
    audio: string[];
    images: string[];
  } = {
    audio: [],
    images: [],
  };

  // get all media assets from each block into mediaAssetsPerBlock
  batchList.forEach((currBatchTrials) => {
    let blockAudio: string[] = [];
    currBatchTrials.forEach((trial) => {
      audioFields.forEach((string) => {
        const trialField = trial[string as 'audioFile' | 'distractors'] as any;

        if (trialField !== undefined && trialField.length !== 0) {
          if (typeof trialField === 'string') {
            blockAudio.push(camelize(trialField));
          } else {
            const trialFieldCamelized = (trialField as string[]).map((key: string) => camelize(key));
            blockAudio.push(...trialFieldCamelized);
          }
        }
      });
    });

    let blockImages: string[] = [];
    currBatchTrials.forEach((trial) => {
      imageFields.forEach((string) => {
        const trialField = trial[string as 'image' | 'distractors' | 'answer' | 'item'] as any;

        if (trialField !== undefined && trialField.length !== 0) {
          if (typeof trialField === 'string') {
            blockImages.push(camelize(trialField));
          } else {
            const trialFieldCamelized = (trialField as string[]).map((key: string) => camelize(key));
            blockImages.push(...trialFieldCamelized);
          }
        }
      });
    });

    // remove duplicate images from current block
    blockImages = [...new Set(blockImages)];

    // remove duplicate assets already required in other blocks
    blockImages = blockImages.filter((asset) => {
      return !batchedAssetNames.images.includes(asset);
    });
    blockAudio = blockAudio.filter((asset) => {
      return !batchedAssetNames.audio.includes(asset);
    });

    batchedAssetNames.audio.push(...blockAudio);
    batchedAssetNames.images.push(...blockImages);

    const blockAssets = filterMedia(mediaAssets, blockImages, blockAudio, []);
    batchedMediaAssets.push(blockAssets);
  });

  return batchedMediaAssets;
}

// separates a corpus into batches of a certain size for asset preloading
export function batchTrials(corpus: StimulusType[], batchSize: number) {
  const finalBatchList: StimulusType[][] = [];
  let currTrialIndex = 0;
  let currBatchIndex = 0;

  corpus.forEach((trial: StimulusType) => {
    if (currTrialIndex === 0) {
      finalBatchList.push([trial]);
    } else {
      finalBatchList[currBatchIndex].push(trial);
    }

    currTrialIndex++;

    if (currTrialIndex >= batchSize) {
      currTrialIndex = 0;
      currBatchIndex++;
    }
  });

  return finalBatchList;
}

// function to gather all media assets that were not specified in the corpus
export function getLeftoverAssets(batchedMediaAssets: MediaAssetsType[], mediaAssets: MediaAssetsType) {
  const allBatchedMedia: MediaAssetsType = combineMediaAssets(batchedMediaAssets);

  const leftoverImageKeys = Object.keys(mediaAssets.images).filter((key) => {
    return !Object.keys(allBatchedMedia.images).includes(key);
  });
  const leftoverAudioKeys = Object.keys(mediaAssets.audio).filter((key) => {
    return !Object.keys(allBatchedMedia.audio).includes(key);
  });
  const leftoverVideoKeys = Object.keys(mediaAssets.video).filter((key) => {
    return !Object.keys(allBatchedMedia.video).includes(key);
  });

  const leftoverMedia = filterMedia(mediaAssets, leftoverImageKeys, leftoverAudioKeys, leftoverVideoKeys);

  return leftoverMedia;
}
