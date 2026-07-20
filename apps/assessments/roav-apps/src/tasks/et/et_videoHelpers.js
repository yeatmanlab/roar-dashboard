import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { jsPsych } from '../shared/helpers/taskSetup';
import { state } from './et_state';
import {
  AssessmentStage,
  fillTextKeyValuesDef,
  ModeGame,
  NameTask,
  TAG_REQ_DEF,
  TypeKey,
} from '../shared/helpers/namingHelpers';
import { mediaAssets } from '../shared/helpers/mediaAssets';
import { sessionGet, sessionSet } from '../shared/helpers/sessionHelpers';
import { ET_SESSION_KEYS as SK } from './et_sessionKeys';
import { ET } from './et_constants';

// TODO: it sets window.cameraStream -- it should NOT be like that

export const et_videoInit = () => {
  const videoIn = document.createElement('video');
  videoIn.id = 'id-input-video';
  videoIn.className = 'videoIn';
  videoIn.style.display = 'none';
  videoIn.setAttribute('playsinline', 'true');
  videoIn.muted = true;
  videoIn.autoplay = true;
  document.body.appendChild(videoIn);
  state.videoIn = videoIn;
  state.videoIn.srcObject = state.cameraStream;
};

export const et_videoStart = () => {
  if (state.videoIn && state.videoIn.srcObject) {
    state.videoIn.play();
  }
};

export const et_videoStop = () => {
  if (state.videoIn && state.videoIn.srcObject) {
    state.videoIn.srcObject.getTracks().forEach((t) => t.stop());
  }
};

export const et_videoPause = () => {
  if (state.videoIn) {
    state.videoIn.pause();
  }
};

const paramsVideoCardHtmlDef = {
  text1: '',
  text2: '',
  text3: '',
  showLineMidVert: false,
  showProgressBar: false,
  showLog: false,
  textBtn1: '',
  idBtn1: '',
  textBtn2: '',
  idBtn2: '',
};

export const et_videoCardHtml = (paramsIn) => {
  const params = { ...paramsVideoCardHtmlDef, ...paramsIn };
  const strVisLog = `visibility: ${params.showLog ? 'visible' : 'hidden'}`;
  const strVisProgressBar = `visibility: ${params.showProgressBar ? 'visible' : 'hidden'}`;
  const strVisLineMidVert = `visibility: ${params.showLineMidVert ? 'visible' : 'hidden'}`;
  const htmlBtn1 =
    params.idBtn1 === ''
      ? ''
      : `<button id="${params.idBtn1}" class="shared-tech-button-medium">
      ${params.textBtn1}
    </button>`;
  const htmlBtn2 =
    params.idBtn2 === ''
      ? ''
      : `<button id="${params.idBtn2}" class="shared-tech-button-medium">
      ${params.textBtn2}
    </button>`;

  // <div style="display: inline-block;">

  const html = `
    <div id="id-log" style="${strVisLog}" class="roav-card-log">
    </div>
    <div class="et-video-card-container">
      <div class="et-video-card-text-wrap">
        ${params.text1 ? `<p>${params.text1}</p>` : '&nbsp'}
        ${params.text2 ? `<p>${params.text2}</p>` : '&nbsp'}
        ${params.text3 ? `<p>${params.text3}</p>` : '&nbsp'}
      </div>
      <div style="width: fit-content;">
        <div 
          class="et-video-card-progress-bar-wrap" 
          style="${strVisProgressBar}"> 
          <div 
            id="id-progress-bar" 
            class="et-video-card-progress-bar">
          </div>
        </div>
        <div style="position: relative">
          <video autoplay muted playsinline
            id="id-video" 
            class="et-video-card-video" 
            style="
              transform: scaleX(-1);
              aspect-ratio: ${ET.VIDEO.WIDTH_REQ / ET.VIDEO.HEIGHT_REQ}">
          </video>
          <div 
            id="id-line-mid-vert" 
            class="et-video-card-line-mid-vert"
            style="${strVisLineMidVert}">
          </div>
        </div>
      </div>
      <div class="shared-tech-button-wrap">
        ${htmlBtn1}
        ${htmlBtn2}          
      </div>
    </div>`;
  return html;
};

//= ======================================================
// t_et_videoEnable
//= ======================================================

const tagtrialVideoEnable = 'video-enable';

const paramsVideoEnableDef = (tagReq = TAG_REQ_DEF, tagModeGame = ModeGame.ALL, tagNameTask = NameTask.ET) => {
  const tagTrial = tagtrialVideoEnable;
  return {
    tagReq: tagReq,
    tagModeGame: tagModeGame, // hint: set to undefined to trigger current game mode
    tagNameTask: tagNameTask, // hint: set to undefined to trigger current task
    text1: [tagTrial, tagReq, 'text1', tagModeGame, tagNameTask],
    text2: [tagTrial, tagReq, 'text2', tagModeGame, tagNameTask],
    keyAudio: [tagTrial, tagReq, '', tagModeGame, tagNameTask],
    textBtn: [tagTrial, tagReq, 'text-button', tagModeGame, tagNameTask],
    keyImg: 'sharedTechIconCameraAll',
    delayBtnsEnable: 4000,
  };
};

export const t_et_videoEnable = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params;
  let videoEnabled = true;
  let strError = '';

  const prepareParams = () => {
    // eslint-disable-next-line no-param-reassign
    paramsIn.tagReq ??= tagReq;

    params = {
      ...fillTextKeyValuesDef(paramsVideoEnableDef(paramsIn.tagReq, paramsIn.tagModeGame, paramsIn.tagNameTask)),
      ...fillTextKeyValuesDef(paramsIn),
    };
  };

  const htmlLayout = () => {
    const hasImg = !!mediaAssets.images[params.keyImg];
    let htmlImg = '';
    if (hasImg) {
      htmlImg = `<img src="${mediaAssets.images[params.keyImg]}" 
        class="shared-tech-card-img-small">`;
    }
    return `
      <div class="shared-tech-card-container">
        ${htmlImg}
        <div class="shared-tech-card-text-wrap">
          ${params.text1 ? `<p>${params.text1}</p>` : ''}
          ${params.text2 ? `<p>${params.text2}</p>` : ''}
        </div>
        <div class="shared-tech-button-wrap">
            <button id="id-button" class="shared-tech-button-medium">
              ${params.textBtn}
            </button>
        </div>
      </div>`;
  };

  const trialVideoEnable = () => ({
    type: jsPsychAudioMultiResponse,
    stimulus: () => mediaAssets.audio[params.keyAudio] ?? mediaAssets.audio.sharedNullAudioAll,
    prompt: () => {
      const html = htmlLayout();
      return html;
    },
    keyboard_choices: () => [TypeKey.DUMMY],
    button_choices: () => [],
    button_html: () => '',
    trial_ends_after_audio: () => false,
    on_load: () => {
      const btn = document.getElementById('id-button');
      btn.disabled = true;
      setTimeout(() => {
        btn.disabled = false;
      }, params.delayBtnsEnable);
      const callbackOnBtnPress = async (e) => {
        if (!e.isTrusted) return;
        e.stopPropagation();
        // TODO: @STATE
        state.cameraStream = await navigator.mediaDevices
          .getUserMedia({
            video: {
              width: { ideal: ET.VIDEO.WIDTH_REQ },
              height: { ideal: ET.VIDEO.HEIGHT_REQ },
              frameRate: { ideal: ET.VIDEO.FPS_REQ, max: ET.VIDEO.FPS_REQ },
              facingMode: 'user',
            },
            // audio: true, // TODO: make sure that we do not need microphone
          })
          // To test that failure path works:
          // state.cameraStream = await Promise.reject(new Error("test denial"))
          .catch((err) => {
            strError = err;
            videoEnabled = false;
          });

        if (videoEnabled) {
          btn.removeEventListener('click', callbackOnBtnPress, {
            capture: true,
          });
          jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
        } else {
          // eslint-disable-next-line no-console
          console.log(`Camera error: ${strError}`);
        }
      };

      btn.addEventListener('click', callbackOnBtnPress, { capture: true });
    },
    on_finish: () => {
      sessionSet(SK.VIDEO_ENABLED, videoEnabled);
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: tagtrialVideoEnable,
        id_trial: tagtrialVideoEnable,
        pid: sessionGet(SK.CONFIG).pid,
        video_enabled: videoEnabled,
        error: strError,
      });
    },
  });

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => prepareParams(),
      },
      trialVideoEnable(),
    ],
    conditional_function: () => sessionGet(SK.VIDEO_ENABLE),
  };
};

//= ======================================================
// t_et_videoConfirm
//= ======================================================

const tagTrialVideoConfirm = 'video-confirm';

const paramsVideoConfirmDef = (tagReq = TAG_REQ_DEF, tagModeGame = ModeGame.ALL, tagNameTask = NameTask.ET) => {
  const tagTrial = tagTrialVideoConfirm;
  return {
    tagReq: tagReq,
    tagModeGame: tagModeGame, // hint: set to undefined to trigger current game mode
    tagNameTask: tagNameTask, // hint: set to undefined to trigger current task
    text1: [tagTrial, tagReq, 'text1', tagModeGame, tagNameTask],
    text2: [tagTrial, tagReq, 'text2', tagModeGame, tagNameTask],
    text3: [tagTrial, tagReq, 'text3', tagModeGame, tagNameTask],
    keyAudio: [tagTrial, tagReq, '', tagModeGame, tagNameTask],
    textBtnYes: [tagTrial, tagReq, 'text-button-yes', tagModeGame, tagNameTask],
    textBtnNo: [tagTrial, tagReq, 'text-button-no', tagModeGame, tagNameTask],
  };
};

export const t_et_videoConfirm = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params;
  let videoConfirmed;

  const prepareParams = () => {
    // eslint-disable-next-line no-param-reassign
    paramsIn.tagReq ??= tagReq;

    params = {
      ...fillTextKeyValuesDef(paramsVideoConfirmDef(paramsIn.tagReq, paramsIn.tagModeGame, paramsIn.tagNameTask)),
      ...fillTextKeyValuesDef(paramsIn),
    };
  };

  const htmlLayout = () => {
    const paramsCard = {
      text1: params.text1,
      text2: params.text2,
      text3: params.text3,
      textBtn1: params.textBtnYes,
      idBtn1: 'id-button-yes',
      textBtn2: params.textBtnNo,
      idBtn2: 'id-button-no',
    };
    return et_videoCardHtml(paramsCard);
  };
  // TODO: video is mirrored left-to-right - maybe a parameter?
  // `
  //   <div class="shared-tech-card-container">
  //     <div>
  //       <video id="id-video" autoplay muted playsinline
  //         class="shared-tech-card-img-xl",
  //         style="
  //           transform: scaleX(-1);
  //           aspect-ratio: ${ET.VIDEO.WIDTH_REQ / ET.VIDEO.HEIGHT_REQ}">
  //        </video>
  //     </div>
  //     <div class="shared-tech-card-text-wrap">
  //       ${params.text1 ? `<p>${params.text1}</p>` : ""}
  //       ${params.text2 ? `<p>${params.text2}</p>` : ""}
  //       ${params.text3 ? `<p>${params.text2}</p>` : ""}
  //     </div>
  //     <div class="shared-tech-button-wrap">
  //         <button id="id-button-yes" class="shared-tech-button-medium">
  //           ${params.textBtnYes}
  //         </button>
  //         <button id="id-button-no" class="shared-tech-button-medium">
  //           ${params.textBtnNo}
  //         </button>
  //     </div>
  //   </div>`;

  const trialVideoConfirm = () => ({
    type: jsPsychAudioMultiResponse,
    stimulus: () => mediaAssets.audio[params.keyAudio] ?? mediaAssets.audio.sharedNullAudioAll,
    prompt: () => htmlLayout(),
    keyboard_choices: () => [TypeKey.DUMMY],
    button_choices: () => [],
    button_html: () => '',
    trial_ends_after_audio: () => false,
    on_load: () => {
      ['id-button-yes', 'id-button-no'].forEach((idBtn) => {
        document.getElementById(idBtn).addEventListener('click', () => {
          videoConfirmed = idBtn === 'id-button-yes';
          jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
        });
      });
      const elVideoView = document.getElementById('id-video');
      if (state.cameraStream) {
        elVideoView.srcObject = state.cameraStream;
      }
    },
    on_finish: () => {
      if (!videoConfirmed) {
        sessionSet(SK.VIDEO_ENABLED, false);
      }
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: tagTrialVideoConfirm,
        id_trial: tagTrialVideoConfirm,
        pid: sessionGet(SK.CONFIG).pid,
        video_view_confirmed: videoConfirmed,
        video_enabled: sessionGet(SK.VIDEO_ENABLED),
      });
    },
  });

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => prepareParams(),
      },
      trialVideoConfirm(),
    ],
    conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
  };
};

// ===============================================================
//  PLAYGROUND
// ===============================================================
export const t_et_videoViewPlayground = () => ({
  type: jsPsychHtmlButtonResponse,
  button_html: '<button class="jspsych-fullscreen-btn" id="id-btn-response">%choice%</button>',
  stimulus: `
    <div class="roav-card-tech">
      <p>Works better is the face is well-lit & no glasses (if possible)</p>
      <br>
      <video id="id-video-camera" autoplay muted playsinline
             style="height:30vh; transform: scaleX(-1)"></video>
    </div>
    <br>
    <br>
    <br>
  `,
  choices: ['GO'],
  response_allowed_while_playing: true,
  on_load: () => {
    const video = document.getElementById('id-video-camera');
    if (state.cameraStream && video) {
      video.srcObject = state.cameraStream;
    }
  },
});

// =========================================================
// VIDEO RECORDING
// =========================================================

function getSupportedMimeType() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export const et_videoRecordStart = () => {
  state.videoChunks = [];
  if (state.videoRecorder && state.videoRecorder.state === 'recording') {
    state.videoRecorder.stop();
  }
  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    // eslint-disable-next-line no-console
    console.error('ET: no supported video MIME type found');
    return;
  }
  state.videoRecorder = new MediaRecorder(state.cameraStream, { mimeType });
  state.videoRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      state.videoChunks.push(event.data);
    }
  };
  state.timeStartVideoRecord = Date.now();
  state.videoRecorder.start();
};

export async function et_videoRecordStop() {
  await new Promise((resolve) => {
    if (state.videoRecorder && state.videoRecorder.state === 'recording') {
      state.videoRecorder.onstop = resolve;
      state.videoRecorder.stop();
    } else {
      resolve();
    }
  });
}

export async function et_videoRecordSave(nameFile) {
  const blob = new Blob(state.videoChunks, { type: 'video/webm' });
  if (blob.size === 0) {
    // eslint-disable-next-line no-console
    console.error('ET: no video data recorded');
    return null;
  }
  try {
    const url = await state.firekit.uploadFileOrBlobToStorage({
      filename: nameFile,
      assessmentPid: sessionGet(SK.CONFIG).pid,
      fileOrBlob: blob,
    });
    return url;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('ET: error uploading video:', error);
    return null;
  }
}

export const et_videoValid = (video) => {
  if (!video) {
    return false;
  }
  return video.readyState >= 2 && video.videoWidth > 0;
};

export const t_et_videoRecordStart = () => ({
  timeline: [
    {
      type: jsPsychCallFunction,
      func: () => et_videoRecordStart(),
    },
  ],
  conditional_function: () => sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.VIDEO_RECORD),
});

export const t_et_videoRecordSave = (nameFileOrFn) => {
  let timeStopVideoRecord = null;
  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        async: true,
        func: (done) => {
          const nameFile = typeof nameFileOrFn === 'function' ? nameFileOrFn() : nameFileOrFn;
          et_videoRecordStop()
            .then(() => {
              timeStopVideoRecord = Date.now();
              return et_videoRecordSave(`${nameFile}_${state.timeStartVideoRecord}_${timeStopVideoRecord}.webm`);
            })
            .then((url) => {
              state.videoRecordUrl = url;
              done();
            })
            .catch(() => done());
        },
        on_finish: () => {
          // alert("Video saved to: " + state.videoRecordUrl);
          jsPsych.data.addDataToLastTrial({
            save_trial: true,
            assessment_stage: AssessmentStage.DATA,
            correct: true,
            type_trial: 'video-record-save',
            pid: sessionGet(SK.CONFIG).pid,
            url: state.videoRecordUrl,
            time_start_video_record: state.timeStartVideoRecord,
            time_stop_video_record: timeStopVideoRecord,
          });
        },
      },
    ],
    conditional_function: () => sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.VIDEO_RECORD),
  };
};
