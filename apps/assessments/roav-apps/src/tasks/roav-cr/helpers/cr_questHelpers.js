import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { sessionGet } from "../../shared/helpers/sessionHelpers";
import { TypeTask } from "../trials/cr_trial";
import { CR_SESSION_KEYS as SK } from "./cr_sessionKeys";
import { quest, createQuest } from "../../shared/trials/questHelpers";

export const calcQuestGamma = (typeTask, numStim, numAngle = 4) => {
  let gamma = 0.5;
  if (typeTask === TypeTask.SHAPE_IDENT) {
    gamma = 1 / numStim;
  } else if (typeTask === TypeTask.ORIENT_IDENT) {
    gamma = 1 / numAngle;
  }
  return gamma;
};

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
    const questNew = createQuest({
      ...(configQuest?.params ?? {}),
      gamma: gamma,
    });
    Object.assign(quest, questNew);
  },
});
