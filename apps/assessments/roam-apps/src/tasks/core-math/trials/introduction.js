import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2';

export const intro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('isK2')) {
      return mediaAssets.audio.coreMathIntroductionK2;
    } else {
      return mediaAssets.audio.coreMathIntroduction;
    }
  },
  prompt: () => {
    if (store.session.get('isK2')) {
      return `
       <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images.coreMathIntro}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <div class="text-image">
                <div>
                  <h1 class="header">${i18next.t('intro.core-math.K2.text1')} </h1>
                  <p class="text"> ${i18next.t('intro.core-math.K2.text2')} </p>
                  <p class="text"> ${i18next.t('intro.core-math.K2.text3')} </p>
                </div>
                <img class="clipart" src=${mediaAssets.images.coreMathNoShadow} alt="tiger"/>

              </div>
            </div>
            
          </div>
        </div>
      `;
    } else {
      return `
      <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images.coreMathIntro}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <div class="text-image">
                <div>
                  <h1 class="header">${i18next.t('intro.core-math.text1')} </h1>
                  <p class="text"> ${i18next.t('intro.core-math.text2')} </p>
                  <p class="text"> ${i18next.t('intro.core-math.text3')} </p>
                </div>
              </div>
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
  on_start: () => {
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
