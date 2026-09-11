export const VALIDATION = {
  RESPONSE_TIME_LOW_THRESHOLD: 250,
  ACCURACY_THRESHOLD: 0.33,
};

export const QUEST = {
  T_GUESS: 1.35, // 1.35 ~ 22.4%
  T_GUESS_SD: 0.3, // 0.3 - good convergence
  P_THRESHOLD: 0.75,
  BETA: 3.5,
  DELTA: 0.03, // standard is 0.01, making it higher for young subjects
  GAMMA: 0.5,
  GRAIN: 0.01,
  RANGE: 1.3, // increasing; was 1.0
};

export const COHERENCE = {
  COH_96: 0.96, // constants from the paper
  COH_48: 0.48,
  COH_24: 0.24,
  COH_12: 0.12,
  COH_06: 0.06,
  CATCH: 1.0,
  PRACTICE: 0.7,
};

export const RDK = {
  // demo
  DURATION_DEMO: 60_000, // 1 minute
  NUMBER_OF_DOTS_DEMO: 250,
  DOT_LIFE_DEMO: 10_000, // 10 seconds
  // practice
  DURATION_PRACTICE_AV: 20_000, // 20 seconds
  NUMBER_OF_DOTS_PRACTICE_AV: 200,
  DURATION_PRACTICE: 15_000, // 15 seconds

  DURATION_AUDIO: 2_000, // audio duration defines trial length
};
