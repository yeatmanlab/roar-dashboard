import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { jsPsych } from '../../taskSetup';
import { mediaAssets } from '../../..';
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2';

let breakCount;
const breakScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    breakCount = store.session.get('breakCount');
    let audioFile = 'coreMathBreak' + breakCount;
    if (store.session.get('config').storyOption || store.session.get('isK2')) {
      audioFile = audioFile + 'K2';
    }
    return mediaAssets.audio[audioFile];
  },
  prompt: () => {
    if (store.session.get('config').storyOption || store.session.get('isK2')) {
      return `
       <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images['coreMathBreakScreen' + breakCount]}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <div class="text-image">
                <div>
                  <h1 class="header">${i18next.t('gameBreak.core-math.break' + breakCount + '.K2-text1')} </h1>
                  <p class="text"> ${i18next.t('gameBreak.core-math.break' + breakCount + '.K2-text2')} </p>
                </div>
                <img class="clipart" src=${mediaAssets.images.coreMathNoShadow} alt="tiger"/>

              </div>
            </div>
            
          </div>
        </div>
      `;
    } else {
      let breakScreenPath = 'coreMathBreakScreen' + store.session.get('breakScreenNames')[breakCount];
      return `
        <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images[breakScreenPath]}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <h1 class="header">${i18next.t('gameBreak.core-math.break' + breakCount + '.text1')} </h1>
              <p class="text"> ${i18next.t('gameBreak.core-math.text1')} </p>
              <p class="text"> ${i18next.t('gameBreak.core-math.text2')} </p>
            </div>
          </div>
        </div>
      `;
    }
  },
  keyboard_choices: () => [],
  button_choices: () => [''],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangle} alt="button"/>`,
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
  on_finish: () => {
    // Mapped to 'practice' (not 'test') so this filler trial is never summed into
    // the test raw score — computedScoreCallback only reads the 'test' stage bucket.
    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      correct: 1,
      assessment_stage: 'practice',
    });

    store.session.transact('breakCount', (oldVal) => oldVal + 1);
    //if the very next trial is textboxResponse, key press should be allowed
    store.session.set('allowKeyUp', true);
  },
};

export const ifBreakScreen = {
  timeline: [breakScreen],
  conditional_function: () => {
    if (
      store.session.get('breakCount') < store.session.get('maxBreaks') &&
      store.session.get('indexTracking') === store.session.get('breakMap')[store.session.get('breakCount')]
    ) {
      /*if (store.session.get("nextStimulus").item_type.includes("Instruction")) {
        //fix break indices by incrementing by 5
        let breakMap = store.session.get("breakMap");
        for (let i = 0; i < breakMap.length; i++) {
          breakMap[i] += 5;
        }
        store.session.set("breakMap", breakMap);
        return false;
      }*/
      if (store.session.get('endGame')) {
        return false;
      }
      return true;
    }
    return false;
  },
};
