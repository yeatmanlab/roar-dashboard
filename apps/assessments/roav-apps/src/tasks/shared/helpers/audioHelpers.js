import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { mediaAssets } from './mediaAssets';
import { jsPsych } from './taskSetup';
import { wrapAsJsPsychTrial } from './jspsychHelpers';

export const stopAudioPlugin = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  try {
    ctx?.suspend?.();
  } catch (_) {
    /* empty */
  }
};

export const createHelperAudioCustom = () => {
  let assetAudio = null;
  let srcAudio = null;
  let bufferAudio = null;
  let durationAudio = 0;

  const setAssetAudio = (assetAudioIn) => {
    assetAudio = assetAudioIn ?? mediaAssets.audio.roavMpNullAudioAll;
  };

  const stopAudioCustom = () => {
    // stop main trial audio
    try {
      srcAudio?.stop?.(0);
    } catch (_) {
      /* empty */
    }
    try {
      srcAudio?.disconnect?.();
    } catch (_) {
      /* empty */
    }
    try {
      srcAudio?.pause?.();
      srcAudio.currentTime = 0;
    } catch (_) {
      /* empty */
    }
  };

  const stopAndClearAudioCustom = () => {
    stopAudioCustom();
    srcAudio = null;
    bufferAudio = null;
  };

  const startAudioCustom = () => {
    stopAudioCustom();
    // dual path for WebKit
    if (bufferAudio) {
      const ctxAudio = jsPsych.pluginAPI.audioContext();

      if (ctxAudio && typeof ctxAudio.createBufferSource === 'function') {
        srcAudio = ctxAudio.createBufferSource();
        srcAudio.buffer = bufferAudio;
        srcAudio.connect(ctxAudio.destination);
        srcAudio.start();
      } else if (typeof bufferAudio.play === 'function') {
        srcAudio = bufferAudio;
        srcAudio.currentTime = 0;
        srcAudio.play().catch(() => {});
      }
    }
  };

  const abortAudioCustomAndPlugin = () => {
    stopAndClearAudioCustom();
    stopAudioPlugin();
  };

  const prepareAudioCustom = async () => {
    try {
      const buffer = await jsPsych.pluginAPI.getAudioBuffer(assetAudio);
      durationAudio = buffer.duration * 1000;
      bufferAudio = buffer;
    } catch {
      bufferAudio = null;
      durationAudio = 0;
    }
  };

  const t_startAudioCustom = () => ({
    timeline: [
      {
        type: jsPsychCallFunction,
        async: true,
        func: (done) => {
          prepareAudioCustom().finally(() => done());
        },
      },
      wrapAsJsPsychTrial(() => startAudioCustom()),
    ],
  });

  return {
    setAssetAudio,
    prepareAudioCustom,
    startAudioCustom,
    stopAudioCustom,
    stopAndClearAudioCustom,
    abortAudioCustomAndPlugin,
    t_startAudioCustom,
    durationAudio: () => durationAudio,
  };
};

export const hasAudio = (keyAudio) => mediaAssets.audio?.[keyAudio] != null;
