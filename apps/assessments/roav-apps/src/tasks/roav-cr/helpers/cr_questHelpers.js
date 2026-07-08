import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { sessionGet } from "../../shared/helpers/sessionHelpers";
import { TypeTask } from "../trials/cr_trial";
import { CR_SESSION_KEYS as SK } from "./cr_sessionKeys";
import { quest, createQuest } from "../../shared/trials/questHelpers";

// TODO: should read from config
export const calcQuestGamma = (typeTask, numStim, numAngle = 4) => {
  let gamma = 0.5;
  if (typeTask === TypeTask.SHAPE_IDENT) {
    gamma = 1 / numStim;
  } else if (typeTask === TypeTask.ORIENT_IDENT) {
    gamma = 1 / numAngle;
  }
  return gamma;
};

/*
export const calcQuestThreshold = (typeTask) => {
  let threshold = 0.75;
  if (typeTask === TypeTask.SHAPE_IDENT) {
    threshold = 0.75;
  } else if (typeTask === TypeTask.ORIENT_IDENT) {
    threshold = 0.75;
  }
  return threshold;
};
*/

export const t_crCreateQuest = () => ({
  type: jsPsychCallFunction,
  func: () => {
    const metaparams = sessionGet(SK.CR_METAPARAMS_BLOCK);
    const gamma = calcQuestGamma(
      metaparams.typeTask,
      metaparams.namesStim?.length,
      metaparams.anglesTarg?.length,
    );
    const configQuest = sessionGet(SK.CONFIG_QUEST);
    // const threshold = calcQuestThreshold(metaparams.typeTask);
    const questNew = createQuest({
      ...(configQuest?.params ?? {}),
      // pThreshold: threshold,
      gamma: gamma,
    });
    /*
    const questNew = createQuest({
      tGuess: 1.5,
      tGuessSd: 0.3,
      pThreshold: threshold,
      beta: 3.5,
      delta: 0.03,
      gamma: gamma,
      grain: 0.01,
      range: 1,
      plotIt: false,
    });
    */
    Object.assign(quest, questNew);
  },
});
