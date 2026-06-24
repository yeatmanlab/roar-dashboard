import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';

import { mediaAssets } from '../experimentSetup';
import '../i18n';
import { storyActive } from '../config/corpus';
import '../styles/game.scss';
import store from 'store2';

//@ts-check
export let storyByLabel, surveyIntroAndInstructions, storyBreakList, practiceCorrect, surveyPracticeDone, endTrial;

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

    // this always returns undefined, I'm not sure why
    // if (mediaAssets.audio[content.imageName] === undefined) {
    //   console.log(content.imageName + " not found. Note: first letter must be lowercase.");
    // }

    if (mediaAssets.audio[content.audioName] === undefined) {
      console.log(`${content.audioName} not found. Note: first letter must be lowercase. text1: ${content.text1}`);
    }
  }

  function createScreenHtml(content) {
    const color = store.session.get('config').task === 'cva' ? 'royalblue' : '#8C1515';

    if (content.screenStyle === 'speechBubble') {
      if (store.session.get('config').task === 'cva') {
        const imgSrc = mediaAssets.images[content.imageName2];

        if (imgSrc) {
          return `
          <div class="cva-gif-container">
          <h1 class="speechbubble-header-cva"> ${content.header1} </h1>
            <div class="cva-text-next-image-adjusted" >
              <img class="device-instructions-cva" src=${
                mediaAssets.images[content.imageName2]
              } alt=${content.imageAlt}" />
              <div class="cva-text-next-image" >
                  <img class="avatar-cva-adjusted" src=${
                    mediaAssets.images[content.imageName1]
                  } alt=${content.imageAlt}" />
                  <div class="speechbubble-container-cva-adjusted">
                  <p class="speechbubble-text-cva-adjusted" style="color: ${color}"> ${content.text1} </p>    
                </div>
              </div>
            </div> 
            
          </div>
  `;
        }
        return `
        <div class="cva-gif-container">
        <h1 class="speechbubble-header-cva"> ${content.header1} </h1>
         
          <div class="cva-text-next-image">
            <p class="speechbubble-text-cva" style="color: ${color}"> ${content.text1} </p>    
            
            <img class="avatar-cva" src=${mediaAssets.images[content.imageName1]} alt=${content.imageAlt}" />
          </div>  
      </div>
`;
      }

      return `
        <div class="lion-gif-container">
          <h1 class="speechbubble-header"> ${content.header1} </h1>
          <p class="speechbubble-text-morphology"> ${content.text1} </p>
          <img class="roar-lion" src=${mediaAssets.images[content.imageName]} alt=${content.imageAlt}"/>
        </div>
      `;
    }

    if (content.screenStyle === 'captionBelowImage') {
      return `
      <div class="lion-gif-container">
        <h1 class="mid-centered-header" style="color: ${color}"> ${content.header1} </h1>
        <p class="mid-centered-text" style="color: ${color}"> ${content.text1} </p>
        <img class="device-instructions" src=${mediaAssets.images[content.imageName]} alt=${content.imageAlt}"/>
      </div>
    `;
    }
  }

  function createStoryTrial(row) {
    checkRowContents(row);
    const screenHtml = createScreenHtml(row);
    return {
      type: jsPsychAudioButtonResponse,
      stimulus: mediaAssets.audio[row.audioName],
      prompt: screenHtml,
      choices: () => ['hi'],
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
  surveyIntroAndInstructions = {
    morphology: {
      timeline: [storyByLabel.intro, storyByLabel.ins, storyByLabel.surveyPractice],
    },
    cva: {
      // cva-intro.csv does not have an "ins" row
      timeline: [
        storyByLabel.cvaWelcome,
        storyByLabel.cvaYouWillSee,
        storyByLabel.cvaYourJob,
        storyByLabel.cvaWordsMakeSense,
        storyByLabel.cvaPractice,
      ],
    },
  };

  // storyBreakList allows the caller to cycle through all the breaks
  storyBreakList = [];
  const initStoryBreakList = () => {
    storyBreakList.push(storyByLabel.break1);
    storyBreakList.push(storyByLabel.break2);
    storyBreakList.push(storyByLabel.break3);
    storyBreakList.push(storyByLabel.break4);
    storyBreakList.push(storyByLabel.break6);
    storyBreakList.push(storyByLabel.break5);
    storyBreakList.push(storyByLabel.break2);
    storyBreakList.push(storyByLabel.break1);
    storyBreakList.push(storyByLabel.break3);
    storyBreakList.push(storyByLabel.break5);
  };

  surveyPracticeDone = {
    timeline: [storyByLabel.surveyPostPractice],
    morphology: {
      timeline: [storyByLabel.surveyPostPractice],
    },
    cva: {
      timeline: [storyByLabel.cvaYoureReady],
    },
  };

  endTrial = {
    timeline: [storyByLabel.ending],
  };

  practiceCorrect = {
    timeline: [storyByLabel.practiceCorrect],
  };

  // uncomment this console log to troubleshoot the story csv file
  // look for filenames labelled undefined
  // note filenames for image and audio must start with a lowercase letter

  initStoryBreakList();
}
