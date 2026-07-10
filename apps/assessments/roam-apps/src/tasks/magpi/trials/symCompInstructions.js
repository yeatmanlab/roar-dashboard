import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..'; //media files
import i18next from 'i18next';
import store from 'store2';
import { symPracticeLoop } from './symPractice';
import { symCompBlock } from './symCompBlock';

const introMagpi = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.symCompIntro;
  },
  prompt: () => {
    return `<div class="tiger-gif-container">
            <div class="speechbubble">
            <h1 class="header">${i18next.t('magpiPilot.symbolicComp.intro.text1')} </h1>
            <p class="text"> ${i18next.t('magpiPilot.symbolicComp.intro.text2')} </p>
            <p class="text"> ${i18next.t('magpiPilot.symbolicComp.intro.text3')} </p>
            </div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
          </div>
        `;
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

const postPracticeMagpi = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('grade') < 2) {
      return mediaAssets.audio.symCompPostPracticeK;
    } else {
      return mediaAssets.audio.symCompPostPractice;
    }
  },
  prompt: () => {
    let reminderText = 'magpiPilot.symbolicComp.postPractice.text4';
    if (store.session.get('grade') < 2) {
      reminderText = 'magpiPilot.symbolicComp.postPractice.text4K';
    }
    return `<div class="tiger-gif-container">
            <div class="speechbubble">
            <h1 class="header">${i18next.t('magpiPilot.symbolicComp.postPractice.text1')}</h1>
            <p class="text">${i18next.t('magpiPilot.symbolicComp.postPractice.text2')}</p>
            <p class="text">${i18next.t('magpiPilot.symbolicComp.postPractice.text3')}</p>
            <p class="text">${i18next.t(reminderText)}</p>
            </div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
          </div>
        `;
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

const symInstructions = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('grade') < 2) {
      return mediaAssets.audio.symCompInstructionsK;
    } else {
      return mediaAssets.audio.symCompInstructions;
    }
  },
  prompt: () => {
    let paraText = `${i18next.t('magpiPilot.symbolicComp.instructions.text1')}`;
    if (store.session.get('grade') < 2) {
      paraText = `${i18next.t('magpiPilot.symbolicComp.instructions.text1K')}`;
    }

    return (
      `
      <div class="jspsych-content-modified">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
        <p class="instructions-text">` +
      paraText +
      `</p>
        <img class="img-border" src="${mediaAssets.images.instructionsSymMagpi}" style="width: 50%;" alt="response">
        <p class="instructions-text">${i18next.t('magpiPilot.symbolicComp.instructions.text2')}</p>
      </div>
      `
    );
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
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

export const introARF = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.symCompEnding;
  },
  prompt: () => {
    return `<div class="tiger-gif-container">
            <div class="speechbubble">
                <h1 class="header">${i18next.t('magpiPilot.symbolicComp.intro.text4')} </h1>
                <p class="text">${i18next.t('magpiPilot.symbolicComp.intro.text5')} </p>
                <div class="text-image">
                    <img class="clipart-paper" src=${mediaAssets.images.paperPencilRed} alt="paper and pencil"/>
                    <p class="text"> ${i18next.t('magpiPilot.symbolicComp.intro.text6')}</p>
                </div>
            </div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
        </div>`;
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

export const magpiPilotTimeline = () => {
  return {
    timeline: [
      introMagpi,
      symInstructions,
      symPracticeLoop('practice', 'practice', 'symbolicComp'),
      postPracticeMagpi,
      symCompBlock('stimulus', 'test', 'symbolicComp'),
    ],
  };
};
