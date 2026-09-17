import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

export const t_timelineScript = (tr) => {
  const arrTrials = [];

  const scriptTimeline = sessionGet(SK.SCRIPT_TIMELINE);

  scriptTimeline.trials.forEach((trial) => {
    arrTrials.push(tr[trial.nameTrial](trial.params, trial.tagReq));
  });

  return {
    timeline: arrTrials,
  };
};
