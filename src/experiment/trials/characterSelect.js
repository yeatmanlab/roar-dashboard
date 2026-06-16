import store from 'store2';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { camelCase } from 'lodash';
import i18next from 'i18next';
import '../i18n';
import { isMobile } from '../experimentHelpers';
import { mediaAssets } from '../experiment';

const studentSelect = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.studentSelect,
  prompt: () => {
    const numOptions = [1, 2, 3, 4];
    const imageAnimals = ['dog', 'cat', 'bird', 'deer'];
    if (isMobile) {
      return `
        <div>
            <img id="mobile-classroom-bg" src=${mediaAssets.images.classroomBackground} alt="background"/>
            <h3>${i18next.t('characterSelect.studentSelect.paragraph1')}</h3>
            <p> ${i18next.t(
              isMobile ? 'characterSelect.studentSelect.paragraph2Mobile' : 'characterSelect.studentSelect.paragraph2',
            )} </p>
        </div>`;
    }
    return ` 
      <div class="jspsych-content-modified">
          <div class="class-container">
          <img id="classroom-bg" src=${mediaAssets.images.classroomBackground} alt="background"> 
          </div> 
          <div class="upper">
              <div class="select-text-block"> <span style="font-weight:bold; white-space:nowrap">
                  <h3>${i18next.t('characterSelect.studentSelect.paragraph1')}</h3>
                  <p> ${i18next.t(
                    isMobile
                      ? 'characterSelect.studentSelect.paragraph2Mobile'
                      : 'characterSelect.studentSelect.paragraph2',
                  )} </p> 
              </div>
          </div>
          ${
            isMobile
              ? ''
              : `<div class="number">${numOptions
                  .map((num) => `<div class="number-block"><n>${num}</n></div>`)
                  .join('')}</div>`
          }
          <div class="student ${isMobile ? 'mobile-student-select-characters' : ''}">
              ${imageAnimals.map((animal) => `<img src=${mediaAssets.images[animal]} alt=${animal}>`).join('')}
          </div>
          <div class="button">
              ${i18next.t('navigation.studentSelect')} 
          </div>
      </div>
  `;
  },
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : ['1', '2', '3', '4']),
  button_choices: () => (isMobile ? ['1', '2', '3', '4'] : []),
  button_html: () => '<button class="grade-btn">%choice%</button>',
  prompt_above_buttons: () => isMobile,
  data: {
    save_trial: false,
  },
  on_load: () => {
    // Doing this to get the proper HTML structure. Prompt and buttons are two seperate tags so you cannot have a structure like
    //     prompt
    //     buttons
    //     animalimages
    // without doing a bunch of weird css stuff to get around the default structure.
    if (isMobile) {
      const audioBtnParent = document.getElementById('jspsych-audio-multi-response-btngroup');
      audioBtnParent.classList.add('mobile-audio-btn-container');

      const parentElement = document.getElementById('jspsych-content');

      if (parentElement) {
        const continueBtn = document.createElement('div');
        const textBeforeSpan = document.createTextNode(
          i18next.t('characterSelect.studentSelect.paragraph3MobileBefore'),
        );
        const textAfterSpan = document.createTextNode(i18next.t('characterSelect.studentSelect.paragraph3MobileAfter'));
        const spanElement = document.createElement('span');
        spanElement.classList.add('yellow');
        spanElement.textContent = i18next.t('characterSelect.studentSelect.paragraph3MobileSpan');
        continueBtn.appendChild(textBeforeSpan);
        continueBtn.appendChild(spanElement);
        continueBtn.appendChild(textAfterSpan);
        continueBtn.classList.add('button');

        const animalParent = document.createElement('div');
        // animalParent.classList.add("mobile-animal-container")
        const imageAnimals = ['dog', 'cat', 'bird', 'deer'];

        const animalElements = imageAnimals.map((animal) => {
          const animalEl = document.createElement('img');
          animalEl.setAttribute('src', mediaAssets.images[animal]);
          animalEl.setAttribute('alt', animal);
          animalEl.classList.add('mobile-character-select');
          return animalEl;
        });

        for (const el of animalElements) {
          animalParent.appendChild(el);
        }

        parentElement.appendChild(animalParent);
        parentElement.appendChild(continueBtn);
      }
    }
  },
  on_finish: (data) => {
    const dataValues = {
      1: {
        character: 'dog',
        characterName: i18next.t('characterSelect.studentCharacter.dog'),
        characterActivity: i18next.t('characterSelect.studentActivity.dog'),
      },
      2: {
        character: 'cat',
        characterName: i18next.t('characterSelect.studentCharacter.cat'),
        characterActivity: i18next.t('characterSelect.studentActivity.cat'),
      },
      3: {
        character: 'bird',
        characterName: i18next.t('characterSelect.studentCharacter.bird'),
        characterActivity: i18next.t('characterSelect.studentActivity.bird'),
      },
      4: {
        character: 'deer',
        characterName: i18next.t('characterSelect.studentCharacter.deer'),
        characterActivity: i18next.t('characterSelect.studentActivity.deer'),
      },
    };

    store.session.set('character', dataValues[isMobile ? data.button_response + 1 : data.keyboard_response].character);
    store.session.set(
      'character_name',
      dataValues[isMobile ? data.button_response + 1 : data.keyboard_response].characterName,
    );
    store.session.set(
      'character_activity',
      dataValues[isMobile ? data.button_response + 1 : data.keyboard_response].characterActivity,
    );
  },
};

const studentIntro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio[camelCase(`${store.session('character')}Intro`)],
  prompt: () => `
    <div class="jspsych-content-modified" id="sre-background">
        <div class="row">
            <div class="column_1">
                <img class="characterleft" src="${
                  mediaAssets.images[camelCase(`${store.session('character')}Talking`)]
                }" alt="animation of student talking">
            </div>
            <div class= "column_3 student-text-block">
                <div class="middle">
                    <p> ${i18next.t('characterSelect.studentIntro.paragraph1')} ${store.session('character_name')}. </p>
                    <p> ${i18next.t('characterSelect.studentIntro.paragraph2')} ${store.session(
                      'character_activity',
                    )}. </p>
                    <p> ${i18next.t('characterSelect.studentIntro.paragraph3')} </p>
                </div>
            </div>
        </div>
        ${
          isMobile
            ? ''
            : `<div class="button">${i18next.t('navigation.continueButtonText', {
                input: `${i18next.t('terms.anyKey')}`,
                action: `${i18next.t('terms.continue')}`,
              })}</div>`
        }
    </div>`,
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    `<button class="button"> ${i18next.t('navigation.continueButtonText', {
      input: `${i18next.t('terms.here')}`,
      action: `${i18next.t('terms.continue')}`,
    })} </button>`,
};

export const ifStudentTrials = {
  timeline: [studentSelect, studentIntro],
  conditional_function: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return false;
    }

    return true;
  },
};
