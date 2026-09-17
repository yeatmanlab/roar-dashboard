import { PageAudioHandler } from './audioHandler';
import { PageStateHandler } from './PageStateHandler';

export async function setupReplayAudio(pageStateHandler: PageStateHandler) {
  PageAudioHandler.replayPresses = 0; // reset to zero at beginning of trial

  if (pageStateHandler.replayBtn) {
    if (pageStateHandler.playStimulusOnLoad) {
      pageStateHandler.disableReplayBtn();
      const enableDelayBuffer = 100; //in ms
      const totalStimulusDurationMs = await pageStateHandler.getStimulusDurationMs(); //in ms
      const totalDelay = totalStimulusDurationMs + enableDelayBuffer;
      setTimeout(() => {
        pageStateHandler.enableReplayBtn();
      }, totalDelay);
    }

    const audioConfig: AudioConfigType = {
      restrictRepetition: {
        enabled: false,
        maxRepetitions: 2,
      },
      onEnded: () => {
        pageStateHandler.enableReplayBtn();
      },
    };

    async function replayAudio() {
      PageAudioHandler.replayPresses++;
      pageStateHandler.disableReplayBtn();
      if (typeof pageStateHandler.audioUri === 'string') {
        PageAudioHandler.playAudio(pageStateHandler.audioUri, audioConfig);
      } else {
        // multiple audio files
        for (let i = 0; i < pageStateHandler.audioUri.length; i++) {
          const audioUri = pageStateHandler.audioUri[i];
          const isLastAudio = i === pageStateHandler.audioUri.length - 1;

          await new Promise<void>((resolve) => {
            const configWithCallback = {
              ...audioConfig,
              onEnded: () => {
                if (isLastAudio) {
                  // replay button only enabled after the last audio has played
                  audioConfig.onEnded?.();
                }
                resolve();
              },
            };
            PageAudioHandler.playAudio(audioUri, configWithCallback);
          });
        }
      }
    }

    pageStateHandler.replayBtn.addEventListener('click', replayAudio);
  }
}
