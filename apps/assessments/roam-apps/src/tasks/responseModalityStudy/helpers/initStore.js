import store from "store2"; //storing browser data
import { shuffle } from "../../shared/helpers";
//sets session data
//local storage does not expire when page(session) is closed, while session storage will expire when page is closed

export const initStoreResponseModality = () => {
  if (store.session.has("initialized") && store.local("initialized")) {
    return store.session;
  }

  // clear any timers if they exist in the browser
  if (store.session.get("timerId")) {
    clearTimeout(store.session.get("timerId"));
  }
  store.session.set("timerId", null);

  // for storing next stimulus
  store.session.set("nextStimulus", null);

  store.session.set("dataCorrect", null); // intialise data correct variable
  store.session.set("correctCount", 0); //correct counter per block/corpus
  store.session.set("totalCorrect", 0); //overall correct
  store.session.set("trialNumTotal", 0); // counter for trials in experiment

  store.session.set("timeOut", false); // initialise the time out variable, gets updated in stimulusNumber.js

  store.session.set("timerDuration", 30000); //set the duration of timer (ms)

  store.session.set("arrayIdx", 0);

  // working copy of the three corpuses (items are removed as they are used)
  store.session.set("currentCorpus", ""); //initialise current corpus as empty string, gets updated in stimulusNumber.js

  store.session.set("response", null);
  store.session.set("allowKeyUp", false);

  // progress bar tracking
  store.session.set("startTimePB", null);
  store.session.set("totalTimePB", store.session.get("timerDuration"));

  //order of response time blocks
  store.session.set("blockOrder", {
    stimulus: shuffle(["2afc", "6afc", "production"]),
  });

  store.session.set("subCorpusName", null);

  //adds response data to validity evaluator
  store.session.set("evaluateValidity", false);

  // index for keeping track of trials for timer
  store.session.set("indexTracking", -1); //gets updated in stimulusNumber.js

  // this should be the last set before return
  store.session.set("initialized", true);

  return store.session;
};
