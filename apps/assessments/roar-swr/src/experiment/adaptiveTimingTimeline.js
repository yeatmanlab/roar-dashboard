import store from 'store2';
import jsPsychCallFunction from '@jspsych/plugin-call-function';

export const createAdaptiveTimingBreakEvents = (numAdaptive) => {
  const adaptiveTimingBlockCount = Math.floor(numAdaptive / 3);
  const adaptiveTimingBlockCounts = [
    adaptiveTimingBlockCount,
    adaptiveTimingBlockCount,
    numAdaptive - 2 * adaptiveTimingBlockCount,
  ];

  const breakEvents = adaptiveTimingBlockCounts.reduce((events, blockCount, index) => {
    const previousTrials = adaptiveTimingBlockCounts.slice(0, index).reduce((sum, count) => sum + count, 0);
    const midBlockTrial = previousTrials + Math.floor(blockCount / 2);
    const postBlockTrial = previousTrials + blockCount;

    events.push({
      endTrialNumTotal: midBlockTrial,
      breakType: 'mid',
      breakIndex: index,
    });

    if (index < adaptiveTimingBlockCounts.length - 1) {
      events.push({
        endTrialNumTotal: postBlockTrial,
        breakType: 'post',
        breakIndex: index,
      });
    }

    return events;
  }, []);

  breakEvents.push({ endTrialNumTotal: numAdaptive });

  return breakEvents;
};

export const createAdaptiveTimingTimeline = ({
  config,
  coreProcedure,
  countdownTrials,
  midBlockPageList,
  postBlockPageList,
  ifNotFullscreen,
}) => {
  const timeline = [];
  const hasTrialsRemaining = () =>
    store.session('adaptiveTimingStopEarly') !== true && store.session('trialNumTotal') <= config.numAdaptive;
  const setAdaptiveTimingBlockIndex = () => {
    const nextBlockIndex = store.session('adaptiveTimingFirstStageComplete') === true ? 1 : 0;

    if (nextBlockIndex === 1 && store.session('currentBlockIndex') !== 1) {
      store.session.set('trialNumBlock', 1);
    }
    store.session.set('currentBlockIndex', nextBlockIndex);
  };

  const makeStageChunk = (endTrialNumTotal) => ({
    timeline: [coreProcedure],
    conditional_function: () => {
      if (!hasTrialsRemaining() || store.session('trialNumTotal') > endTrialNumTotal) return false;
      setAdaptiveTimingBlockIndex();
      return true;
    },
    loop_function: () => {
      if (!hasTrialsRemaining() || store.session('trialNumTotal') > endTrialNumTotal) return false;

      return !(store.session('currentBlockIndex') === 0 && store.session('adaptiveTimingFirstStageComplete') === true);
    },
  });

  const makeCountdown = () => ({
    ...countdownTrials,
    conditional_function: hasTrialsRemaining,
  });

  const makeTransitionBreak = () => ({
    timeline: [
      postBlockPageList[0],
      ifNotFullscreen,
      {
        type: jsPsychCallFunction,
        func: () => store.session.set('adaptiveTimingTransitionBreakShown', true),
      },
      makeCountdown(),
    ],
    conditional_function: () =>
      store.session('adaptiveTimingFirstStageComplete') === true &&
      store.session('adaptiveTimingTransitionBreakShown') !== true &&
      hasTrialsRemaining(),
  });

  createAdaptiveTimingBreakEvents(config.numAdaptive).forEach(({ endTrialNumTotal, breakType, breakIndex }) => {
    timeline.push({
      timeline: [
        makeCountdown(),
        makeStageChunk(endTrialNumTotal),
        makeTransitionBreak(),
        makeStageChunk(endTrialNumTotal),
      ],
    });

    const breakPage = breakType === 'mid' ? midBlockPageList[breakIndex] : postBlockPageList[breakIndex];
    if (breakPage) {
      timeline.push({
        timeline: [breakPage, ifNotFullscreen],
        conditional_function: () => store.session('trialNumTotal') > endTrialNumTotal && hasTrialsRemaining(),
      });
    }
  });

  return timeline;
};
