import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import _round from 'lodash/round';
import i18next from 'i18next';
import { playAudio, stopAudio, initializeNumberLine, setMarkerFromValue } from './numberLineSlider';
import { isMobile } from '../../fluency/helpers';

const delayAfterPlayback = () => {
  let timerForceId = setTimeout(() => {
    jsPsych.finishTrial();
  }, 500);
  store.session.set('timerForceId', timerForceId);
};

const enableButton = (btn) => {
  btn.classList.remove('disabled');
  btn.style.pointerEvents = 'auto';
};

export const transitionScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('isK2')) {
      return mediaAssets.audio['numLineIntroK2'];
    } else {
      return mediaAssets.audio['numLineIntro'];
    }
  },
  prompt: () => {
    if (store.session.get('isK2')) {
      return `
       <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images['coreMathBreakScreen3']}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <div class="text-image">
                <div>
                  <h1 class="header">${i18next.t('magpiPilot.numberLine.transition.K2-text1')} </h1>
                  <p class="text">${i18next.t('magpiPilot.numberLine.transition.K2-text2')} </p>
                  <p class="text">${i18next.t('magpiPilot.numberLine.transition.K2-text3')} </p>
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
          <img src="${mediaAssets.images['coreMathBreakScreen3']}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <h1 class="header">${i18next.t('magpiPilot.numberLine.transition.text1')} </h1>
              <p class="text">${i18next.t('magpiPilot.numberLine.transition.text2')}</p>
              <p class="text">${i18next.t('magpiPilot.numberLine.transition.text3')}</p>
              <p class="text">${i18next.t('magpiPilot.numberLine.transition.text4')}</p>
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
};

const transitionScreen2 = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get('blockType') === 20) {
      return mediaAssets.audio['numLinePostPractice20'];
    } else if (store.session.get('blockType') === 100) {
      if (store.session.get('arrayIdx') > 0) {
        return mediaAssets.audio['numLinePostPractice100K2'];
      } else {
        return mediaAssets.audio['numLinePostPractice100'];
      }
    } else {
      return mediaAssets.audio['numLinePostPractice1'];
    }
  },
  prompt: () => {
    if (store.session.get('isK2')) {
      let headerText = `${i18next.t('magpiPilot.numberLine.transition.K2-text4')}`;
      let paraText = `${i18next.t('magpiPilot.numberLine.transition.K2-text5')}`;
      if (store.session.get('arrayIdx') > 0) {
        paraText = `${i18next.t('magpiPilot.numberLine.transition.K2-text6')}`;
      }

      return (
        `
       <div class = "jspsych-content-modified">
          <img src="${mediaAssets.images['coreMathBreakScreen3']}" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <div class="text-image">
                <div>
                  <h1 class="header">` +
        headerText +
        `</h1>
                  <p class="text">` +
        paraText +
        `</p>
                  <p class="text">${i18next.t('magpiPilot.numberLine.transition.text9')}</p>
                </div>
                <img class="clipart" src=${mediaAssets.images.coreMathNoShadow} alt="tiger"/>

              </div>
            </div>
            
          </div>
        </div>
      `
      );
    } else {
      let headerText = `${i18next.t('magpiPilot.numberLine.transition.text5')}`;
      let paraText = `${i18next.t('magpiPilot.numberLine.transition.text6')}`;
      if (store.session.get('arrayIdx') > 0) {
        headerText = `${i18next.t('magpiPilot.numberLine.transition.text7')}`;
        paraText = `${i18next.t('magpiPilot.numberLine.transition.text8')}`;
      }
      return (
        `
            <div class = "jspsych-content-modified">
            <img src="${mediaAssets.images['coreMathBreakScreen3']}" alt= "background" class="imageBG"> 
            <div class="tiger-gif-container">
                <div class="speechbubble">
                <h1 class="header">` +
        headerText +
        `</h1>
                <p class="text">` +
        paraText +
        `</p>
                <p class="text">${i18next.t('magpiPilot.numberLine.transition.text9')}</p>
                </div>
            </div>
            </div>
        `
      );
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
};

const instructionIntro1 = () => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      let displayText;
      if (store.session.get('blockType') === 20) {
        displayText = `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text1', {
          number: store.session.get('blockType'),
        })}<br>${i18next.t('magpiPilot.numberLine.text3')}</div>`;
      } else if (store.session.get('blockType') === 100 && store.session.get('arrayIdx') === 0) {
        displayText = `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text1', {
          number: store.session.get('blockType'),
        })}<br>${i18next.t('magpiPilot.numberLine.text4')}</div>`;
      } else {
        displayText = `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text2', {
          number: store.session.get('blockType'),
        })}<br>${i18next.t('magpiPilot.numberLine.text5')}</div>`;
      }

      return (
        displayText +
        `<div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>
                `
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: false,
    on_start: () => {
      const timerId = setTimeout(() => {
        let marker = document.getElementById('marker');
        marker.classList.remove('marker-hidden');
        marker.classList.remove('pulse-twice');

        requestAnimationFrame(() => {
          marker.classList.add('pulse-twice');
        });
      }, 1000);
      store.session.set('timerId', timerId);
    },
    on_load: () => {
      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = minValue;
      const step = store.session.get('blockStepInstruction')[maxValue];
      const marker = document.getElementById('marker');
      // hide thumb initially
      marker.classList.add('marker-hidden');

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');
      continueBtn.classList.add('go-button-hidden');

      // Place marker
      setMarkerFromValue(currentValue, step, minValue, maxValue, marker);

      let blockType = store.session.get('blockType');
      let audioFile = 'numLineInstr' + blockType;
      if (store.session.get('isK2') && store.session.get('arrayIdx') > 0) {
        audioFile = audioFile + 'K2';
      }

      playAudio(audioFile, delayAfterPlayback);
    },
    on_finish: () => {
      // pause audio
      stopAudio();
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerForceId'));
    },
  };
  return stim;
};

const instructionIntro2 = () => {
  let handleContinueClick;

  let stim = {
    type: jsPsychHtmlButtonResponse,
    data: {
      assessment_stage: 'practice',
    },
    stimulus: () => {
      let displayText;

      let number = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        number = store.session.get('exampleFrac');
      }

      if (store.session.get('arrayIdx') === 0) {
        displayText = `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text6', {
          number: number,
          interpolation: {
            escapeValue: false,
          },
        })} ${i18next.t('magpiPilot.numberLine.text7')}</div>
                    <div class="number-line-item-below hidden">${i18next.t('magpiPilot.numberLine.text8')}</div>`;
      } else {
        displayText = `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text6', {
          number: number,
          interpolation: {
            escapeValue: false,
          },
        })}</div>
                    <div class="number-line-item-below hidden">${i18next.t('magpiPilot.numberLine.text8')}</div>`;
      }
      return (
        displayText +
        `<div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>
                `
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: false,
    on_load: () => {
      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');
      continueBtn.classList.add('go-button-hidden');
      const continueText = document.querySelector('.number-line-item-below');

      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = minValue;
      const step = store.session.get('blockStepInstruction')[maxValue];
      const line = document.getElementById('line');
      const marker = document.getElementById('marker');

      handleContinueClick = () => {
        jsPsych.finishTrial({ response: currentValue });
      };

      continueBtn.addEventListener('click', handleContinueClick);

      let blockType = store.session.get('blockType');
      let audioFile = 'numLinePractice' + blockType;
      if (store.session.get('isK2') && store.session.get('arrayIdx') > 0) {
        audioFile = audioFile + 'K2';
      }

      playAudio(audioFile);

      initializeNumberLine({
        line,
        marker,
        minValue,
        maxValue,
        step,
        onChange: (value) => {
          currentValue = value;
        },
        onFirstInteraction: () => {
          continueText.classList.remove('hidden');
          continueBtn.classList.remove('go-button-hidden');
          playAudio('numLinePracticeDone');
        },
      });
    },
    on_finish: (data) => {
      // pause audio
      stopAudio();

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');

      if (continueBtn) {
        continueBtn.removeEventListener('click', handleContinueClick);
      }

      let target = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        target = _round(target, 1) / 2;
      }
      let absDifference = _round(Math.abs(data.response - target), 3);
      let perError = _round((absDifference / store.session.get('blockType')) * 100, 2);
      store.session.set('perError', perError);

      let subCorpusName = store.session.get('subCorpusName');
      jsPsych.data.addDataToLastTrial({
        subtask: 'numberLine',
        save_trial: true,
        time_out: null,
        pid: store.session.get('config').pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get('indexTracking') + 2,
        item_id: null,
        problem_id: null,
        problem_version: null,
        theoretical_difficulty: null,
        block: null,
        correct: 1,
        abs_difference: absDifference,
        percent_error: perError,
        item: store.session.get('blockType'),
        target: target,
        is_mobile: isMobile,
      });
    },
  };
  return stim;
};

const practiceFeedbackCorrect = () => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      let number = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        number = store.session.get('exampleFrac');
      }
      return (
        `<div class="number-line-item">
                    ${i18next.t('magpiPilot.numberLine.feedback.text1')} 
                    ${i18next.t('magpiPilot.numberLine.feedback.text3', {
                      number: number,
                      interpolation: {
                        escapeValue: false,
                      },
                    })}
                </div>
                <div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>`
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: true,
    on_start: () => {
      const timerId = setTimeout(() => {
        let marker = document.getElementById('marker');
        marker.classList.remove('marker-hidden');
        marker.classList.remove('pulse-twice');

        requestAnimationFrame(() => {
          marker.classList.add('pulse-twice');
        });
      }, 1000);
      store.session.set('timerId', timerId);
    },
    on_load: () => {
      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        currentValue = _round(store.session.get('blockType') / 2, 1);
      }
      const step = store.session.get('blockStepInstruction')[maxValue];
      const marker = document.getElementById('marker');
      marker.classList.add('marker-hidden');

      // Place marker
      setMarkerFromValue(currentValue, step, minValue, maxValue, marker);

      let blockType = store.session.get('blockType');
      let audioFile = 'numLinePractice' + blockType + 'Correct';

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');
      continueBtn.classList.add('go-button-hidden');
      playAudio(audioFile, delayAfterPlayback);
    },
    on_finish: () => {
      // pause audio
      stopAudio();
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerForceId'));
    },
  };
  return stim;
};

const practiceFeedbackIncorrect = () => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      let number = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        number = store.session.get('exampleFrac');
      }
      return (
        `<div class="number-line-item">
                    ${i18next.t('magpiPilot.numberLine.feedback.text2')} 
                    ${i18next.t('magpiPilot.numberLine.feedback.text3', {
                      number: number,
                      interpolation: {
                        escapeValue: false,
                      },
                    })} ${i18next.t('magpiPilot.numberLine.feedback.text4')}
                </div>
                <div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>`
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: true,
    on_start: () => {
      const timerId = setTimeout(() => {
        let marker = document.getElementById('marker');
        marker.classList.remove('marker-hidden');
        marker.classList.remove('pulse-infinite');
        marker.classList.remove('pulse-twice');

        requestAnimationFrame(() => {
          marker.classList.add('pulse-infinite');
        });
      }, 1000);
      store.session.set('timerId', timerId);
    },
    on_load: () => {
      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = store.session.get('blockType');
      if (store.session.get('blockType') === 1) {
        currentValue = _round(store.session.get('blockType') / 2, 1);
      }
      const step = store.session.get('blockStepInstruction')[maxValue];
      const marker = document.getElementById('marker');
      marker.classList.add('marker-hidden');

      // Place marker
      setMarkerFromValue(currentValue, step, minValue, maxValue, marker);

      let blockType = store.session.get('blockType');
      let audioFile = 'numLinePractice' + blockType + 'Incorrect';

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');
      continueBtn.classList.add('go-button-hidden');
      playAudio(audioFile);

      //click the marker
      marker.addEventListener('pointerdown', () => {
        jsPsych.finishTrial({
          response: currentValue,
        });
      });
    },
    on_finish: () => {
      // pause audio
      stopAudio();
      clearTimeout(store.session.get('timerId'));
    },
  };
  return stim;
};

const demoFrac1 = () => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      return (
        `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text9')}</div>
                <div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>
                `
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: true,
    on_start: () => {
      const timerId = setTimeout(() => {
        let marker = document.getElementById('marker');
        marker.classList.remove('marker-hidden');
        marker.classList.remove('pulse-twice');

        requestAnimationFrame(() => {
          marker.classList.add('pulse-twice');
        });
      }, 500);
      store.session.set('timerId', timerId);
    },
    on_load: () => {
      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = _round(store.session.get('blockType') / 2, 1);
      const step = store.session.get('blockStepInstruction')[maxValue];
      const marker = document.getElementById('marker');
      marker.classList.add('marker-hidden');

      const continueBtn = document.getElementById('jspsych-html-button-response-button-0');
      continueBtn.classList.add('go-button-hidden');

      // Initial position (left end)
      setMarkerFromValue(currentValue, step, minValue, maxValue, marker);

      playAudio('numLineDemo12', delayAfterPlayback);
    },
    on_finish: () => {
      // pause audio
      stopAudio();
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerForceId'));
    },
  };
  return stim;
};

const demoFrac2 = () => {
  let stim = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      return (
        `<div class="number-line-item">${i18next.t('magpiPilot.numberLine.text10', {
          number: store.session.get('demoFrac'),
          interpolation: {
            escapeValue: false,
          },
        })} ${i18next.t('magpiPilot.numberLine.transition.text8')}</div>
                    <div class="number-line-item-below">${i18next.t('magpiPilot.numberLine.transition.text9')}</div>
                <div class="number-line-container">
                    <div class="number-line-element" id="line">
                        <div class="tick left"></div>
                        <div class="tick right"></div>

                        <div class="marker" id="marker"></div>

                        <div class="label left">0</div>
                        <div class="label right">` +
        store.session.get('blockType') +
        `</div>
                    </div>
                </div>
                `
      );
    },
    choices: [''],
    button_html: `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    response_ends_trial: true,
    on_start: () => {
      const timerId = setTimeout(() => {
        let marker = document.getElementById('marker');
        marker.classList.remove('marker-hidden');
        marker.classList.remove('pulse-twice');

        requestAnimationFrame(() => {
          marker.classList.add('pulse-twice');
        });
      }, 500);
      store.session.set('timerId', timerId);
    },
    on_load: () => {
      //disable button until audio finishes playing
      const btn = document.getElementById('go-button-id');
      btn.classList.add('disabled');
      btn.style.pointerEvents = 'none';

      const minValue = 0;
      const maxValue = store.session.get('blockType');
      let currentValue = 1.5;
      const step = store.session.get('blockStepInstruction')[maxValue];
      const marker = document.getElementById('marker');
      marker.classList.add('marker-hidden');

      // Place marker
      setMarkerFromValue(currentValue, step, minValue, maxValue, marker);

      playAudio('numLineDemo22', () => enableButton(btn));
    },
    on_finish: () => {
      // pause audio
      stopAudio();
      clearTimeout(store.session.get('timerId'));
    },
  };
  return stim;
};

const ifCorrectFeedback = () => {
  return {
    timeline: [practiceFeedbackCorrect()],
    conditional_function: () => {
      if (store.session.get('perError') > 2) {
        return false;
      }
      return true;
    },
  };
};

const ifIncorrectFeedback = () => {
  return {
    timeline: [practiceFeedbackIncorrect()],
    conditional_function: () => {
      if (store.session.get('perError') > 2) {
        return true;
      }
      return false;
    },
  };
};

const practiceBlock = () => {
  let timelineObj = [
    instructionIntro1(),
    instructionIntro2(),
    ifCorrectFeedback(),
    ifIncorrectFeedback(),
    transitionScreen2,
  ];
  return {
    timeline: timelineObj,
  };
};

const demoBlock = () => {
  let timelineObj = [instructionIntro1(), demoFrac1(), demoFrac2()];
  return {
    timeline: timelineObj,
  };
};

export const ifPractice = () => {
  return {
    timeline: [practiceBlock()],
    conditional_function: () => {
      if (store.session.get('blockType') !== 2) {
        return true;
      }
      return false;
    },
  };
};

export const ifDemo = () => {
  return {
    timeline: [demoBlock()],
    conditional_function: () => {
      if (store.session.get('blockType') === 2) {
        return true;
      }
      return false;
    },
  };
};
