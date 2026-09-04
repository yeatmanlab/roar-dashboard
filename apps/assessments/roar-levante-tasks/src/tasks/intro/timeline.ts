import 'regenerator-runtime/runtime';
// setup
import { initTrialSaving, initTimeline, createPreloadTrials } from '../shared/helpers';
import { instructions } from './trials/instructions';
import { jsPsych } from '../taskSetup';
// trials
import { enterFullscreen, exitFullscreen, taskFinished } from '../shared/trials';

export default function buildIntroTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const timeline = [preloadTrials, initialTimeline, ...instructions];

  timeline.push(taskFinished('introFinished'));
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
