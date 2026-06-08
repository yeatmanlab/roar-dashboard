import AudioMultiResponsePlugin from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import i18next from 'i18next';
import '../i18n';
import { isTouchScreen } from '../experimentSetup';
import { mediaAssets } from '../experiment';

const midBlockTrialsContent = [
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.midBlock1;
      }
      return mediaAssets.audio.midBlock1Ns;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `
      <div>
        <h1>${i18next.t('gameBreakTrials.midBlockTrials.trial1.header1')}</h1>
        <div>
          <p class="center" style="position: relative; top: 50%; margin-bottom: 1.5rem;">${i18next.t(
            'gameBreakTrials.midBlockTrials.trial1.paragraph1',
          )}</p>
          <p class="center" style="position: relative; top: 50%;">${i18next.t(
            'gameBreakTrials.midBlockTrials.trial1.paragraph2',
          )}</p>  
        </div>
        <div class = "story-scene">
          <img class="scene" src="${mediaAssets.images.halfValley}" alt="background image with hills and trees">
          <img class = 'adventure_mid_break' src="${mediaAssets.images.adventurer1}" alt="adventurer with harp">
        </div>
      </div>
      ${
        !isTouchScreen
          ? `<div class="button">${i18next.t('navigation.continueButtonText', {
              action: `${i18next.t('terms.continue')}`,
            })}</div>`
          : ''
      }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.midBlockTrials.trial1.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial1.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial1.paragraph4')}</p>
    <img class="charactercenter" src="${mediaAssets.images.break}" alt="animation of a wizard waving a magic wand">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
    },
  },
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.midBlock2;
      }
      return mediaAssets.audio.midBlock2Ns;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `
        <div>
        <h1>${i18next.t('gameBreakTrials.midBlockTrials.trial2.header1')}</h1>
        <div>
        <p class="center" style="position: relative; top: 50%; margin-bottom: 1.5rem;">${i18next.t(
          'gameBreakTrials.midBlockTrials.trial2.paragraph1',
        )}</p>
        <p class="center" style="position: relative; top: 50%;">${i18next.t(
          'gameBreakTrials.midBlockTrials.trial2.paragraph2',
        )}</p>
      </div>
      <div class="story-scene">
        <img class="scene" src="${mediaAssets.images.valley4}" alt="background with hills and trees">
        <img class = 'adventure_mid_break' src="${mediaAssets.images.adventurer1}" alt="adventurer with harp">
        <img class = 'adventure_mid_break' src="${
          mediaAssets.images.adventurer3
        }" alt="adventurer with making heart shapes">
      </div>
    </div>
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.midBlockTrials.trial2.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial2.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial2.paragraph4')}</p>
    <img class="charactercenter" src="${mediaAssets.images.break}" alt="animation of a wizard waving a magic wand">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
    },
  },
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.midBlock3;
      }
      return mediaAssets.audio.midBlock3Ns;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `<div>
      <h1>${i18next.t('gameBreakTrials.midBlockTrials.trial3.header1')}</h1>
      <div>
          <p class="center" style="position: relative; top: 50%; margin-bottom: 1.5rem;">${i18next.t(
            'gameBreakTrials.midBlockTrials.trial3.paragraph1',
          )}</p>
          <p class="center" style="position: relative; top: 50%;">${i18next.t(
            'gameBreakTrials.midBlockTrials.trial3.paragraph2',
          )}</p>
      </div>
      <div class="story-scene">
        <img class="scene" src="${mediaAssets.images.valley3}" alt="backgroun image with hills and trees">
        <img class = 'adventure_mid_break'  src="${mediaAssets.images.adventurer1}" alt="adventurer with harp">
        <img class = 'adventure_mid_break'  src="${mediaAssets.images.adventurer3}" alt="adventurer playing rainbow">
        <img class = 'adventure_mid_break'  src="${
          mediaAssets.images.adventurer2
        }" alt="adventurer making heart shapes">
      </div>
    </div>
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.midBlockTrials.trial3.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial3.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.midBlockTrials.trial3.paragraph4')}</p>
    <img class="charactercenter" src="${mediaAssets.images.break}" alt="animation of a wizard waving a magic wand">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
    },
  },
];

// eslint-disable-next-line no-unused-vars
const midBlockTrialsMapped = midBlockTrialsContent.map((trial, _i) => ({
  type: AudioMultiResponsePlugin,
  stimulus: trial.stimulus,
  keyboard_choices: () => (isTouchScreen ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isTouchScreen ? ['HERE'] : []),
  button_html: () =>
    `<button class='button'>${i18next.t('navigation.continueButtonTextMobile', {
      action: `${i18next.t('terms.continue')}`,
    })}</button>`,
  response_allowed_while_playing: () => store.session.get('config').skipInstructions,
  prompt: trial.prompt,
  prompt_above_buttons: true,
}));

const midBlockPageList = [...midBlockTrialsMapped];

// post block page

const postBlockTrialsContent = [
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.endBlock1;
      }
      return mediaAssets.audio.endBlock1Ns;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `
        <div>
        <h1>${i18next.t('gameBreakTrials.postBlockTrials.trial1.header1')}</h1>
        <div>
        <p class="center" style="margin-bottom: 1.5rem;">${i18next.t(
          'gameBreakTrials.postBlockTrials.trial1.paragraph1',
        )}</p> 
        <p class="center">${i18next.t('gameBreakTrials.postBlockTrials.trial1.paragraph2')}</p>
      </div>
      <div class = "story-scene">
        <img class="scene" src="${mediaAssets.images.valley}" alt="background image of hills and trees">
        <img class='wizard' src="${mediaAssets.images.wizardCoin}" alt="adventure playing rainbow">
        <img class="guardian" src="${mediaAssets.images.guardian1}" alt="adventure making heart shapes">
      </div>
    </div>
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.postBlockTrials.trial1.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial1.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial1.paragraph4')}</p>
    <img class="coin" src="${mediaAssets.images.goldCoin}" alt="coin">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })} </div>`
        : ''
    }`;
    },
  },
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.endBlock2;
      }
      return mediaAssets.audio.endBlock2Ns;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `
        <div>
      <h1>${i18next.t('gameBreakTrials.postBlockTrials.trial2.header1')}</h1>
      <div>
        <p class="center" style="margin-bottom: 1.5rem;">${i18next.t(
          'gameBreakTrials.postBlockTrials.trial2.paragraph1',
        )}</p>

        <p class="center">${i18next.t('gameBreakTrials.postBlockTrials.trial2.paragraph2')}</p>
      </div>
      <div class="story-scene">
        <img class="scene" src="${mediaAssets.images.valley5}" alt="background image of hills and trees">
        <img class='wizard' src="${mediaAssets.images.wizardCoin}" alt="adventure playing rainbow">
        <img class='guardian' src="${mediaAssets.images.guardian2}" alt="adventure making heart shapes">
      </div>
    </div>
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.postBlockTrials.trial2.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial2.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial2.paragraph4')}</p>
    <img class="coin" src="${mediaAssets.images.goldCoin}" alt="coin">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })} </div>`
        : ''
    }`;
    },
  },
  {
    stimulus: () => {
      if (store.session.get('config').story) {
        return mediaAssets.audio.endBlock1;
      }
      return mediaAssets.audio.endBlockGeneralNs;
    },
    prompt: () => {
      if (store.session.get('config').story) {
        return `
        <div>
       <h1>${i18next.t('gameBreakTrials.postBlockTrials.trial3.header1')}</h1>
      <div>
        <p class="center" style="margin-bottom: 1.5rem;">${i18next.t(
          'gameBreakTrials.postBlockTrials.trial3.paragraph1',
        )}</p>

        <p class="center">${i18next.t('gameBreakTrials.postBlockTrials.trial3.paragraph2')}</p>
      </div>
      <div class="story-scene">
        <img class="scene" src="${mediaAssets.images.valley5}" alt="background image of hills and trees">
        <img class='wizard' src="${mediaAssets.images.wizardCoin}" alt="adventure playing rainbow">
        <img class='guardian' src="${mediaAssets.images.guardian2}" alt="adventure making heart shapes">
      </div>
    </div>
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })}</div>`
        : ''
    }`;
      }
      return `<h1>${i18next.t('gameBreakTrials.postBlockTrials.trial3.header2')}</h1>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial3.paragraph3')}</p>
    <p>${i18next.t('gameBreakTrials.postBlockTrials.trial3.paragraph4')}</p>
    <img class="coin" src="${mediaAssets.images.goldCoin}" alt="coin">
    ${
      !isTouchScreen
        ? `<div class="button">${i18next.t('navigation.continueButtonText', {
            action: `${i18next.t('terms.continue')}`,
          })} </div>`
        : ''
    }`;
    },
  },
];

const postBlockTrialsMapped = postBlockTrialsContent.map((trial) => ({
  type: AudioMultiResponsePlugin,
  stimulus: trial.stimulus,
  keyboard_choices: () => (isTouchScreen ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isTouchScreen ? ['HERE'] : []),
  button_html: () =>
    `<button class='button'>${i18next.t('navigation.continueButtonTextMobile', {
      action: `${i18next.t('terms.continue')}`,
    })}</button>`,
  response_allowed_while_playing: () => store.session.get('config').skipInstructions,
  prompt: trial.prompt,
  prompt_above_buttons: true,
}));

const postBlockPageList = [...postBlockTrialsMapped];

const finalPage = {
  type: AudioMultiResponsePlugin,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.endGame;
    }
    return mediaAssets.audio.endGameNs;
  },
  keyboard_choices: () => (isTouchScreen ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isTouchScreen ? ['HERE'] : []),
  button_html: () =>
    `<button class='button'>${i18next.t('navigation.continueButtonTextMobile', {
      action: `${i18next.t('terms.save')}`,
    })}</button>`,
  response_allowed_while_playing: () => store.session.get('config').skipInstructions,
  prompt_above_buttons: true,
  prompt: () => {
    if (store.session.get('config').story) {
      return `
      <div>
      <h1>${i18next.t('gameBreakTrials.finalTrial.header1')}</h1>
      <div>
      <p class="center" style="margin-bottom: 1.5rem;">${i18next.t('gameBreakTrials.finalTrial.paragraph1')}</p>
      <p class="center">${i18next.t('gameBreakTrials.finalTrial.paragraph2')}</p>
      </div>
      <div class="story-scene">
      <img class="scene" src="${mediaAssets.images.endingBackground}" alt="background image of gate">
      <img class='guardian' src="${mediaAssets.images.guardian3}" alt="image of a unicorn winking">
      <img class='guardian' id = "gate" src="${mediaAssets.images.endingGateCoinbag}" alt="gate">
    </div>
  </div>
  ${
    !isTouchScreen
      ? `<div class="button">${i18next.t('navigation.continueButtonText', {
          action: `${i18next.t('terms.save')}`,
        })}</div>`
      : ''
  }`;
    }
    return `<h1>${i18next.t('gameBreakTrials.finalTrial.header2')}</h1>
  <p>${i18next.t('gameBreakTrials.finalTrial.paragraph3')}</p>
  <p>${i18next.t('gameBreakTrials.finalTrial.paragraph4')}</p>
  <img class="coin" src="${mediaAssets.images.goldCoin}" alt="coin">
  ${
    !isTouchScreen
      ? `<div class="button">${i18next.t('navigation.continueButtonText', {
          action: `${i18next.t('terms.save')}`,
        })}</div>`
      : ''
  }`;
  },
  on_finish: function () {
    document.body.style.cursor = 'auto';
  },
};

export { midBlockPageList, postBlockPageList, finalPage };
