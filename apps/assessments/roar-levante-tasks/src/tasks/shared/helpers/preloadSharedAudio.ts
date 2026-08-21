import { createPreloadTrials, filterMedia } from './';
import { taskStore } from '../../../taskStore';
import { mediaAssets } from '../../..';

export function preloadSharedAudio() {
  const sharedAudio = filterMedia(mediaAssets, [], taskStore().assetsPerTask.shared.audio, []);

  return createPreloadTrials(sharedAudio).default;
}
