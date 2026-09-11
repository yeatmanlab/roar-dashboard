/*
Initialises jspsych with progress bar details.
*/

import { initJsPsych } from 'jspsych';
import i18next from 'i18next'; //get the i18next functions
import '../i18n/i18n'; //get i18next class as defined in i18n.js to get the text for progress bar
import store from 'store2'; //storing session data

const redirectInfo = {
  cdm: 'https://stanford-cogsci.org:8880/landing_page.html',
  demo: 'https://roar.stanford.edu/',
  prolific: {
    YeatmanLab: {
      fluencyArf: 'https://app.prolific.com/submissions/complete?cc=CDAO8JGT',
      fluencyCalf: 'https://app.prolific.com/submissions/complete?cc=C13EIE8W',
    },
  },
};

/*const prolificNumberLab = (group, study, assessmentPid, taskName) => {
  let urlString;
  if (taskName === "fluency-arf") {
    urlString =
      "https://roam-apps.web.app/?audio=false&consent=false&keyboardPractice=false&labId=numberLab&recruitment=prolific&responseMode=production&storyOption=false&task=fluency-calf&mode=default&lng=en&participant=" +
      assessmentPid +
      "&group=" +
      group.toString() +
      "&study=" +
      study;
  } else if (taskName === "fluency-calf") {
    if (group > 0 && group < 5) {
      urlString =
        "https://run.pavlovia.org/alexamogan/letterwm/?participant=" +
        assessmentPid +
        "&group=" +
        group.toString() +
        "&study=" +
        study;
    } else {
      urlString =
        "https://run.pavlovia.org/alexamogan/numberwm/?participant=" +
        assessmentPid +
        "&group=" +
        group.toString() +
        "&study=" +
        study;
    }
  } else if (taskName === "roam-alpaca") {
    if (group % 2 === 1) {
      urlString =
        "https://run.pavlovia.org/alexamogan/lexicaldecision/?participant=" +
        assessmentPid +
        "&group=" +
        group.toString() +
        "&study=" +
        study;
    } else {
      urlString =
        "https://run.pavlovia.org/alexamogan/numbercomparison/?participant=" +
        assessmentPid +
        "&group=" +
        group.toString() +
        "&study=" +
        study;
    }
  }
  return urlString;
};*/

//controls which combination of url params appear next based on the study group (prolific)
export const groupMapping = {
  1: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-afc',
        setNumber: '1',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-production',
        setNumber: '2',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-afc',
        setNumber: '3',
      },
      production: {
        endAudio: 'production-game-end',
        setNumber: '4',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
      },
    },
  },
  2: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-afc',
        setNumber: '2',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-production',
        setNumber: '1',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-afc',
        setNumber: '3',
      },
      production: {
        endAudio: 'production-game-end',
        setNumber: '4',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-arf',
        responseMode: 'production',
      },
    },
  },
  3: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-afc',
        setNumber: '1',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-production',
        setNumber: '2',
      },
    },
    'fluency-calf': {
      '6afc': {
        endAudio: 'afc-game-end',
        setNumber: '4',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-production',
        setNumber: '3',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
      },
    },
  },
  4: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-afc',
        setNumber: '2',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-production',
        setNumber: '1',
      },
    },
    'fluency-calf': {
      '6afc': {
        endAudio: 'afc-game-end',
        setNumber: '4',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-production',
        setNumber: '3',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-arf',
        responseMode: 'production',
      },
    },
  },
  5: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-afc',
        setNumber: '3',
      },
      production: {
        endAudio: 'production-game-end',
        setNumber: '4',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-afc',
        setNumber: '1',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-production',
        setNumber: '2',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
      },
    },
  },
  6: {
    'fluency-arf': {
      '2afc': {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-afc',
        setNumber: '3',
      },
      production: {
        endAudio: 'production-game-end',
        setNumber: '4',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-afc',
        setNumber: '2',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-production',
        setNumber: '1',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-calf',
        responseMode: 'production',
      },
    },
  },
  7: {
    'fluency-arf': {
      '2afc': {
        endAudio: 'afc-game-end',
        setNumber: '4',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-production',
        setNumber: '3',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-calf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-afc',
        setNumber: '1',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-production',
        setNumber: '2',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
      },
    },
  },
  8: {
    'fluency-arf': {
      '2afc': {
        endAudio: 'afc-game-end',
        setNumber: '4',
      },
      production: {
        taskName: 'fluency-arf',
        responseMode: '2afc',
        endText: 'responseModalityStudy.endScreen.text4',
        endAudio: 'responseModalityStudy-end-screen-4-production',
        setNumber: '3',
      },
    },
    'fluency-calf': {
      '6afc': {
        taskName: 'fluency-arf',
        responseMode: 'production',
        endText: 'responseModalityStudy.endScreen.text3',
        endAudio: 'responseModalityStudy-end-screen-3-afc',
        setNumber: '2',
      },
      production: {
        taskName: 'fluency-calf',
        responseMode: '6afc',
        endText: 'responseModalityStudy.endScreen.text2',
        endAudio: 'responseModalityStudy-end-screen-2-production',
        setNumber: '1',
      },
    },
    'response-modality-study': {
      production: {
        taskName: 'fluency-calf',
        responseMode: 'production',
      },
    },
  },
};

const prolificResponseModality = (taskName, responseMode, group, assessmentPid) => {
  let urlString;
  let baseURL = 'https://roam-apps.web.app/';
  let nextParams = groupMapping[group][taskName][responseMode];
  if (nextParams.taskName === undefined) {
    //urlString = "https://roar.stanford.edu/";
    urlString = 'https://app.prolific.com/submissions/complete?cc=C15C8DS2'; //redirect to prolific completion page
  } else {
    urlString =
      baseURL +
      '?audio=false&consent=false&keyboardPractice=false&labId=YeatmanLab&recruitment=prolific&storyOption=false&mode=default&lng=en&task=' +
      nextParams.taskName +
      '&responseMode=' +
      nextParams.responseMode +
      '&participant=' +
      assessmentPid +
      '&group=' +
      group.toString();
  }
  return urlString;
};

/*const queryString = new URL(window.location).search; //returns a dictionary with various parameters of the URL or the "query string"
const urlParams = new URLSearchParams(queryString); //restructures the dictionary for accessing the key-value pairs
const taskName = urlParams.get("task") ?? "fluency-arf";*/

export const jsPsych = initJsPsych({
  auto_update_progress_bar: false,
  message_progress_bar: `${i18next.t('progressBar')}`,
  on_finish: () => {
    document.body.style.cursor = 'auto';
    const config = store.session.get('config');
    if (config.recruitment === 'cdm') {
      window.location.href = redirectInfo.cdm;
    }
    if (config.recruitment === 'demo') {
      window.location.href = redirectInfo.demo;
    }
    if (config.recruitment === 'prolific') {
      window.location.href = prolificResponseModality(config.taskName, config.responseMode, config.group, config.pid);

      /*if (config.labId === "numberLab") {
        window.location.href = prolificNumberLab(
          config.group,
          config.study,
          config.pid,
          config.taskName,
        );
      } else {
        window.location.href =
          redirectInfo.prolific[config.labId][dashToCamelCase(config.taskName)];
      }*/
    }
  },
});
