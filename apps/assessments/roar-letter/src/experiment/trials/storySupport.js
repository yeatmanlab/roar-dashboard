import store from 'store2';
import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import { mediaAssets } from '../experiment';
import '../i18n';
import { storyActive } from '../config/corpus';
import { isMaxTimeoutReached } from './appTimer';
import { isEarlyStopReached } from './stimulusLetterName';
import { PHONICS_TASK_IDS } from '@roar-platform/assessment-schema/roar-letter';

export let letterIntroAndInstructions;

export let letterPracticeDone;

export let letterTransition;

export let soundIntroAndInstructions;

export let practiceCorrectFeedback;

export let soundPracticeDone;

export let endTrial;

export let storyByLabel;

export let storyBreak;

export let storyBreakList;

export let blockBreaks;

export let phonicsIntroAndInstructions;

export let phonicsYoureReady;

export let phonicsAllDone;

export let breakVariables;

export let breakTrials;

export function createStory() {
  function checkRowContents(content) {
    // fix null strings
    if (content.header1 === null) {
      content.header1 = '';
    }

    if (content.text1 === null) {
      content.text1 = '';
    }

    if (content.text2 === null) {
      content.text2 = '';
    }

    if (content.text3 === null) {
      content.text3 = '';
    }

    if (content.imageAlt === null) {
      content.imageAlt = '';
    }

    if (!mediaAssets.images[content.imageName]) {
      console.log(`${content.imageName} not found. Note: first letter must be lowercase.`);
    }

    if (!mediaAssets.audio[content.audioName]) {
      console.log(`${content.audioName} not found. Note: first letter must be lowercase.`);
    }
  }

  // This function is used to create the Html for the prompt field of the trial. Each screenStyle is a general pattern
  // (such as text below an image) that will be populated with a specific image and text from the csv file
  function createScreenHtml(content) {
    if (store.session.get('config').task === PHONICS_TASK_IDS.EN) {
      if (content.screenStyle === 'speechBubble') {
        return `
      <div class="phonics-gif-container">
        <h1 class="phonics-speechbubble-header"> ${content.header1} </h1>
        <p class="phonics-speechbubble-text"> ${content.text1} </p>
        <img class="avatar-phonics" src=${mediaAssets.images[content.imageName]} alt=${content.imageAlt}"/>
      </div>
    `;
      }
      if (content.screenStyle === 'captionBelowImage') {
        return `
      <div class="phonics-gif-container">
        <div class="wrapper">
          <h1 class="phonics-mid-centered-header"> ${content.header1} </h1>
          <p class="phonics-mid-centered-text"> ${content.text1} </p>
          <img class="phonics-device-instructions-gif" src=${mediaAssets.images[content.imageName]} alt=${
            content.imageAlt
          }"/>
        </div>
      </div>`;
      }
    }

    if (content.screenStyle === 'speechBubble') {
      return `
      <div class="lion-gif-container">
        <h1 class="speechbubble-header"> ${content.header1} </h1>
        <p class="speechbubble-text"> ${content.text1} </p>
        <p class="speechbubble-text"> ${content.text2} </p>
        <img class="roar-lion" src=${mediaAssets.images[content.imageName]} alt=${content.imageAlt}"/>
      </div>
    `;
    }
    if (content.screenStyle === 'captionBelowImage') {
      return `
    <div class="gif-container">
      <div class="wrapper">
        <h1 class="mid-centered-header"> ${content.header1} </h1>
        <p class="mid-centered-text"> ${content.text1} </p>
        <img class="device-instructions-gif" src=${mediaAssets.images[content.imageName]} alt=${content.imageAlt}"/>
      </div>
    </div>`;
    }
    return '';
  }

  function createStoryTrial(row) {
    checkRowContents(row);

    // combine images and text into a prompt
    const screenHtml = createScreenHtml(row);
    return {
      type: jsPsychAudioButtonResponse,
      stimulus: mediaAssets.audio[row.audioName],
      trial_ends_after_audio: false, // autoplay through story
      response_allowed_while_playing: true,
      response_ends_trial: true, // allow skipping via button
      trial_duration: row.audioLengthMs,
      prompt: screenHtml,
      choices: () => ['next'],
      button_html: () => `<img class="go-button" src=${mediaAssets.images.goButton} alt="button"/>`,
    };
  }

  // Create a dictionary to store story trials indexed by label
  storyByLabel = [];

  // StoryActive is read from a csv file in config
  // note filenames for image and audio must start with a lowercase letter
  storyActive.forEach((row) => {
    const { label } = row;
    const storyTrial = createStoryTrial(row);

    // add entry to array
    if (!storyByLabel[label]) {
      storyByLabel[label] = [];
    }

    storyByLabel[label] = storyTrial;
  });

  //  storyByLabel contains the html for the story organized by label
  letterIntroAndInstructions = {
    timeline: [
      storyByLabel.lettersIntro,
      storyByLabel.lettersIns,
      storyByLabel.lettersIns2,
      storyByLabel.lettersIns3,
      // storyByLabel["lettersIns4"],  // we decided to delete second example
      // storyByLabel["lettersIns5"],
      storyByLabel.lettersIns6,
      storyByLabel.lettersPractice,
    ],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  storyBreak = {
    timeline: [storyByLabel.break3],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached() || isEarlyStopReached()) return false;
    },
  };

  storyBreakList = [];
  const initStoryBreakList = () => {
    const breaks = [
      storyByLabel.break1,
      storyByLabel.break3,
      storyByLabel.break2,
      storyByLabel.break4,
      storyByLabel.break5,
    ];

    // storyBreakList with conditional
    const ifBreakList = breaks.map((i) => ({
      timeline: [i],
      conditional_function: () => {
        if (isMaxTimeoutReached() || isEarlyStopReached()) {
          return false;
        }
        return true;
      },
    }));

    storyBreakList.push(ifBreakList[0]);
    storyBreakList.push(ifBreakList[1]);
    storyBreakList.push(ifBreakList[2]);
    storyBreakList.push(ifBreakList[3]);
    storyBreakList.push(ifBreakList[4]);
  };

  letterPracticeDone = {
    timeline: [storyByLabel.lettersPostPractice],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  letterTransition = {
    timeline: [storyByLabel.lettersUppercaseTrans],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  soundIntroAndInstructions = {
    timeline: [
      storyByLabel.soundsIntro,
      storyByLabel.soundsIns,
      storyByLabel.soundsIns2,
      storyByLabel.soundsIns3,
      storyByLabel.soundsIns6,
      storyByLabel.soundsPractice,
    ],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  soundPracticeDone = {
    timeline: [storyByLabel.soundsPostPractice],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  blockBreaks = {
    timeline: [storyByLabel.break1, storyByLabel.break3, storyByLabel.break2, storyByLabel.break4, storyByLabel.break5],
  };

  breakVariables = blockBreaks.timeline.map((breakItem, index) => ({
    breakStimulus: breakItem,
    breakIndex: index,
  }));

  breakTrials = blockBreaks.timeline.map((breakItem, index) => ({
    timeline: [breakItem],
    conditional_function: () => {
      const breakNumber = store.session.get('breakNumber');
      return breakNumber === index;
    },
  }));

  endTrial = {
    timeline: [storyByLabel.lettersComplete],
    // no conditional, always play the goodby message
  };

  practiceCorrectFeedback = {
    timeline: [storyByLabel.thatsRight],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  //
  // uncomment this console log to troubleshoot the story csv file
  // look for filenames labelled undefined
  // note filenames for image and audio must start with a lowercase letter

  // phonics story

  //  storyByLabel contains the html for the story organized by label
  phonicsIntroAndInstructions = {
    timeline: [
      storyByLabel.phonicsWelcome,
      storyByLabel.phonicsYouWillHear,
      storyByLabel.phonicsYourJob,
      storyByLabel.phonicsForExample,
      storyByLabel.phonicsSpellNop,
      storyByLabel.phonicsSpeaker,
      storyByLabel.phonicsPractice,
    ],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  phonicsYoureReady = {
    timeline: [storyByLabel.phonicsYoureReady],

    conditional_function: () => {
      // don't play when skipping trials because app is finished
      if (isMaxTimeoutReached()) return false;
    },
  };

  phonicsAllDone = {
    timeline: [storyByLabel.allDone],
    // no conditional, all ways play the allDone message
  };

  initStoryBreakList();
}
