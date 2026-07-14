/*
Defines jspsych objects for instruction screens.
*/
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..'; //media files
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2'; //storing session data
import { camelize } from '@bdelab/roar-utils';
//import { groupMapping } from "../../taskSetup";
import { isMobile } from '../helpers';

export const intro = (responseMode) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (store.session.get('responseModality')) {
        let mediaFile;
        if (store.session.get('config').taskName === 'fluency-arf') {
          let rtControl = store.session.get('blockOrderRT')[0];
          if (rtControl.includes('production')) {
            mediaFile = 'responseModalityIntroductionFluencyArfProduction';
          } else if (rtControl.includes('2afc')) {
            mediaFile = 'responseModalityIntroductionFluencyArf2afc';
          } else {
            mediaFile = 'responseModalityIntroductionFluencyArf6afc';
          }
        } else {
          if (responseMode.includes('production')) {
            mediaFile = 'responseModalityIntroductionFluencyCalfProduction';
          } else {
            mediaFile = 'responseModalityIntroductionFluencyCalfAfc';
          }
        }
        return mediaAssets.audio[mediaFile];
      }
      return mediaAssets.audio[
        camelize(
          store.session.get('config').responseMode.replace(/\d+/g, '') +
            '-introduction-' +
            store.session.get('config').taskName +
            '-' +
            store.session.get('config').labId,
        )
      ];
    },
    prompt: () => {
      let config = store.session.get('config');
      let headerString, paraString, paperString;
      let imageName = mediaAssets.images.paperPencilGreen;
      if (store.session.get('config').taskName === 'fluency-arf') {
        imageName = mediaAssets.images.paperPencilRed;
      }
      let pressAnyKey = '';
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        pressAnyKey = `<div class="key-button"> ${i18next.t('navigation.continueButtonText', {
          input: `${i18next.t('terms.anyKey')}`,
          action: `${i18next.t('terms.continue')}`,
        })} </div>`;
      }
      paperString = `<div class="text-image">
                <img class="clipart-paper" src=${imageName} alt="paper and pencil"/>
                <p class="text"> ${i18next.t('intro.' + store.session.get('config').taskName + '.text2')} </p>
              </div>`;

      if (store.session.get('responseModality')) {
        /*let mode = "responseModalityStudy.intro.text5";
        if (config.responseMode === "production") {
          mode = "responseModalityStudy.intro.text6";
        }
        headerString = `<h1 class="header">${i18next.t(
          "responseModalityStudy.intro.text3",
          {
            number: `${
              groupMapping[config.group][config.taskName][config.responseMode]
                .setNumber
            }`,
          },
        )} </h1>`;
        paraString = `<p class="text">${i18next.t(
          "responseModalityStudy.intro.text4",
          {
            mode: `${i18next.t(mode)}`,
          },
        )}</p>`;*/
        headerString = `<h1 class="header">${i18next.t('intro.' + config.taskName + '.' + config.labId)} </h1>`;
        if (store.session.get('config').taskName === 'fluency-arf') {
          let blockOne = store.session.get('blockOrderRT')[0];
          let practiceText = `${i18next.t('responseModalityStudy.instructions.text6')}`;
          let mode = isMobile
            ? 'responseModalityStudy.instructions.text10'
            : 'responseModalityStudy.instructions.text9';
          if (blockOne === 'rtControl_2afc') {
            practiceText = `${i18next.t('responseModalityStudy.instructions.text7', {
              mode: `${i18next.t(mode)}`,
            })}`;
          } else if (blockOne === 'rtControl_6afc') {
            practiceText = `${i18next.t('responseModalityStudy.instructions.text8', {
              mode: `${i18next.t(mode)}`,
            })}`;
          }
          paraString =
            `<p class="text"> ${i18next.t(
              'responseModalityStudy.intro.text8',
            )} ${i18next.t('responseModalityStudy.instructions.text2')} </p>
          <p class="text"> ${i18next.t('responseModalityStudy.instructions.text3')} ` +
            practiceText +
            `</p>
          `;
          paperString = '';
        } else {
          let mode = 'responseModalityStudy.intro.text9';
          if (responseMode.includes('afc')) {
            mode = isMobile ? 'responseModalityStudy.intro.text11' : 'responseModalityStudy.intro.text10';
          }
          paraString = `<p class="text"> ${i18next.t('responseModalityStudy.intro.text7', {
            mode: `${i18next.t(mode)}`,
          })} </p>`;
        }
      } else {
        headerString = `<h1 class="header">${i18next.t('intro.' + config.taskName + '.' + config.labId)} </h1>`;
        paraString = `<p class="text"> ${i18next.t('intro.' + config.taskName + '.text1')} </p>`;
      }

      return (
        `
          <div class="tiger-gif-container">
            <div class="speechbubble">` +
        headerString +
        paraString +
        paperString +
        `</div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
          </div>
        ` +
        pressAnyKey
      );
    },
    keyboard_choices: () => {
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        return 'ALL_KEYS';
      }
      return [];
    },
    button_choices: () => {
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        return [];
      }
      return [''];
    },
    button_html: () =>
      `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      if (store.session.get('config').responseMode != 'production' || store.session.get('responseModality')) {
        document.body.style.cursor = 'auto';
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
      } else {
        document.body.style.cursor = 'none';
      }
    },
    on_load: () => {
      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }
    },
  };
};

export const postPracticeReminder = (responseMode) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (store.session.get('responseModality')) {
        /*return mediaAssets.audio[
          camelize(
            "responseModalityStudy-post-practice-1-" +
              store.session.get("config").responseMode.replace(/\d+/g, ""),
          )
        ];*/
        if (!isMobile && responseMode === 'production') {
          return mediaAssets.audio['productionPostPractice1Arrow'];
        }
      }
      return mediaAssets.audio[responseMode.replace(/\d+/g, '') + 'PostPractice1'];
    },
    prompt: () => {
      let skipText = 'postPractice.text10';
      if (responseMode === 'production') {
        skipText = 'postPractice.text4';
        if (isMobile) {
          skipText = 'postPractice.text12';
        }
      }
      let pressAnyKey = '';
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        pressAnyKey = `<div class="key-button"> ${i18next.t('navigation.continueButtonText', {
          input: `${i18next.t('terms.anyKey')}`,
          action: `${i18next.t('terms.continue')}`,
        })} </div>`;
      }
      return (
        `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h3 class="header">${i18next.t('postPractice.text1')} </h3>
            <p class="text"> ${i18next.t('postPractice.text2')} </p>
            <p class="text">1. ${i18next.t('postPractice.text3')}</p>
            <p class="text">2. ${i18next.t(skipText)}</p>
          </div>
          <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
        </div>
      ` + pressAnyKey
      );
    },
    keyboard_choices: () => {
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        return 'ALL_KEYS';
      }
      return [];
    },
    button_choices: () => {
      if (
        store.session.get('config').responseMode === 'production' &&
        !isMobile &&
        !store.session.get('responseModality')
      ) {
        return [];
      }
      return [''];
    },
    button_html: () =>
      `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      if (store.session.get('config').responseMode != 'production' || store.session.get('responseModality')) {
        document.body.style.cursor = 'auto';
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
      }
    },
    on_load: () => {
      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }
    },
  };
};

export const preMainIntro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('responseModality')) {
      /*return mediaAssets.audio[
        camelize(
          "responseModalityStudy-post-practice-2-" +
            store.session.get("config").taskName +
            "-" +
            store.session.get("config").responseMode.replace(/\d+/g, ""),
        )
      ];*/
      if (store.session.get('config').taskName === 'fluency-arf') {
        return mediaAssets.audio[camelize('afc-post-practice-2-fluency-arf')];
      } else {
        return mediaAssets.audio[camelize('afc-post-practice-2-fluency-calf-4andHalfMin')];
      }
    }
    if (store.session.get('config').recruitment === 'demo') {
      return mediaAssets.audio[
        camelize(
          store.session.get('config').responseMode.replace(/\d+/g, '') +
            '-post-practice2-' +
            store.session.get('config').taskName +
            '-demo',
        )
      ];
    } else if (
      store.session.get('config').userMode === '4andHalfMin' &&
      store.session.get('config').taskName === 'fluency-calf'
    ) {
      return mediaAssets.audio[
        camelize(
          store.session.get('config').responseMode.replace(/\d+/g, '') +
            '-' +
            'post-practice2-' +
            store.session.get('config').taskName +
            '-' +
            store.session.get('config').userMode,
        )
      ];
    }
    return mediaAssets.audio[
      camelize(
        store.session.get('config').responseMode.replace(/\d+/g, '') +
          '-' +
          'post-practice2-' +
          store.session.get('config').taskName,
      )
    ];
  },
  prompt: () => {
    let imageFile = mediaAssets.images[store.session.get('displayImage')];
    let instructionText = 'postPractice.' + store.session.get('config').taskName;
    if (store.session.get('config').taskName === 'fluency-calf') {
      imageFile = mediaAssets.images.paperAndPencil;
      instructionText =
        'postPractice.' + store.session.get('config').taskName + '-' + store.session.get('config').labId;
      if (store.session.get('config').labId === 'numberLab') {
        imageFile = mediaAssets.images.paperAndPencilCalculatorVertical;
      }
    }
    let pressAnyKey = '';
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      pressAnyKey = `<div class="key-button"> ${i18next.t('postPractice.text9')} </div>`;
    }
    /*if (store.session.get("responseModality")) {
      return (
        `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h3 class="header">${i18next.t("postPractice.text5")} </h3>
            <p class="text"> ${i18next.t(
              "responseModalityStudy.instructions.text5",
              {
                time: `${store.session.get("totalTimePB") / 60000}`,
              },
            )} </p>
          </div>
          <img class="roam-tiger" src=${imageFile} alt="tiger"/>
        </div>
      ` + pressAnyKey
      );
    }*/
    if (store.session.get('config').recruitment === 'demo') {
      return (
        `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h3 class="header">${i18next.t('postPractice.text5')} </h3>
            <p class="text"> ${i18next.t(instructionText)} </p>
            <p class="text"> ${i18next.t('postPractice.text11')} </p>
            <p class="text"> ${i18next.t('postPractice.text7')} </p>
            <p class="text"> ${i18next.t('postPractice.text8')} </p>
            
          </div>
          <img class="roam-tiger" src=${imageFile} alt="tiger"/>
        </div>
      ` + pressAnyKey
      );
    }
    return (
      `
    <div class="tiger-gif-container">
      <div class="speechbubble">
        <h3 class="header">${i18next.t('postPractice.text5')} </h3>
        <p class="text"> ${i18next.t(instructionText)} </p>
        <p class="text"> ${i18next.t('postPractice.text6', {
          time: `${store.session.get('totalTimePB') / 60000}`,
        })} </p>
        <p class="text"> ${i18next.t('postPractice.text7')} </p>
        <p class="text"> ${i18next.t('postPractice.text8')} </p>
        
      </div>
      <img class="roam-tiger" src=${imageFile} alt="tiger"/>
    </div>
  ` + pressAnyKey
    );
  },
  keyboard_choices: () => {
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      return 'ALL_KEYS';
    }
    return [];
  },
  button_choices: () => {
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      return [];
    }
    return [''];
  },
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    if (store.session.get('config').responseMode != 'production' || store.session.get('responseModality')) {
      document.body.style.cursor = 'auto';
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    }
  },
  on_load: () => {
    //disable button to prevent double clicks
    const btn = document.getElementById('go-button-id');
    if (btn) {
      btn.style.pointerEvents = 'none';
      setTimeout(() => {
        btn.style.pointerEvents = 'auto';
      }, 1000);
    }
  },
};

export const postRTControl = (responseMode) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (responseMode === 'production') {
        return mediaAssets.audio.responseModalityPostControlProduction;
      } else {
        return mediaAssets.audio.responseModalityPostControlAfc;
      }
    },
    prompt: () => {
      let mode = 'responseModalityStudy.endScreen.text10';
      if (responseMode.includes('afc')) {
        mode = isMobile ? 'responseModalityStudy.endScreen.text12' : 'responseModalityStudy.endScreen.text11';
      }

      let text = `${i18next.t('responseModalityStudy.endScreen.text7', {
        mode: `${i18next.t(mode)}`,
      })}`;

      return (
        `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h3 class="header">${i18next.t('responseModalityStudy.endScreen.text5')} </h3>
            <p class="text"> ${i18next.t('responseModalityStudy.endScreen.text6')} ` +
        text +
        `</p>
            <div class="text-image">
                <img class="clipart-paper" src=${mediaAssets.images.paperPencilRed} alt="paper and pencil"/>
                <p class="text"> ${i18next.t('intro.' + store.session.get('config').taskName + '.text2')} </p>
            </div>
          </div>
          <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
        </div>
      `
      );
    },
    keyboard_choices: () => {
      return [];
    },
    button_choices: () => {
      return [''];
    },
    button_html: () =>
      `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      document.body.style.cursor = 'auto';
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    },
    on_load: () => {
      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }
    },
  };
};
