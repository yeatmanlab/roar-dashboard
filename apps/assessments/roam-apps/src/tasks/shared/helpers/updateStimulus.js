import store from "store2";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { clowder } from "../../fluency/helpers/fetchAndParseCorpus";

const catOrderMap = {
  0: "sum",
  1: "minus",
  2: "mult",
  3: "div",
};

const getNextStimulus = (corpusName) => {
  let corpus, nextStimulus, remainingStimuli;

  // read the current version of the corpus
  corpus = store.session.get("currentCorpus");
  if (
    store.session.get("config").userMode === "adaptive" &&
    corpusName === "stimulus"
  ) {
    let catIndex = store.session.get("currentCatIndex");

    if (catIndex == undefined) {
      store.session.set("currentCatIndex", 0);
      catIndex = 0;
    }

    const catName = catOrderMap[catIndex];
    const previousItem = store.session.get("previousItem");
    const previousAnswer = store.session.get("previousAnswer");

    const nextStimulus = clowder.updateCatAndGetNextItem({
      catToSelect: catName,
      catsToUpdate: ["total", "sum", "minus", "mult", "div"],
      items: previousItem ?? undefined,
      answers: previousAnswer ?? undefined,
      randomlySelectUnvalidated: false,
    });

    if (nextStimulus === undefined) {
      store.session.remove("nextStimulus");
      const catIndex = (store.session.get("currentCatIndex") ?? -1) + 1;
      store.session.set("currentCatIndex", catIndex);
      if (catIndex < 4) {
        getNextStimulus(corpusName);
      }
    } else {
      store.session.set("nextStimulus", nextStimulus);
    }
  } else {
    nextStimulus = corpus[0];
    // get the remaining stimuli
    remainingStimuli = corpus.slice(1);
    // store the item for use in the trial
    store.session.set("nextStimulus", nextStimulus);
    // update the corpus with the remaining unused items
    corpus = remainingStimuli;
    store.session.set("currentCorpus", corpus);
  }
};

export const updateStimulus = (corpusName) => {
  let stim = {
    type: jsPsychCallFunction,
    func: () => {
      // for keeping track of number of trials completed
      store.session.transact("indexTracking", (oldVal) => oldVal + 1);
      getNextStimulus(corpusName);
    },
  };
  return stim;
};
