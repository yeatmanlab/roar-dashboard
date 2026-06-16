# adaptiveTimingMultiStage Design Documentation

## Overview

`adaptiveTimingMultiStage` is a SWR user mode designed to begin with an untimed startup stage and then, when the participant demonstrates enough early success, transition into the standard timed adaptive task.

The total run is capped at 84 test trials, matching `shortAdaptive`.

## Goals

- Start with easier validated infinite-presentation items.
- Use adaptive item selection from the beginning.
- Let the first stage continue until the participant meets a readiness rule.
- Transition to 350 ms presentation timing after readiness is reached.
- Preserve the usual `shortAdaptive` break rhythm across 84 trials.
- Stop early for very low-performing first-stage runs.
- Keep existing variants, including `shortAdaptive`, behaviorally unchanged.

## Stage 1: Untimed Startup Stage

Stage 1 uses:

- Corpus: `dataNewEasyURL`, stored as `corpusNewEasy`.
- Presentation time: infinite, represented by `null`.
- Item selection: `mfi`.
- CAT update: updates `cat` even though these are `corpusNewEasy` items.

The CAT update is intentional. The transition rule depends on `cat.theta`, so `cat.theta` must move during the startup stage. Existing modes continue to exclude `corpusNew` and `en-corpusNew-easy` from the main CAT update unless they are in `adaptiveTimingMultiStage`.

## Transition Rule

The run transitions from stage 1 to stage 2 when both conditions are true:

- The participant has 4 consecutive correct responses.
- `cat.theta > -2`.

These values are stored on `config.adaptiveTiming.transitionConsecutiveCorrect` and `config.adaptiveTiming.transitionThetaThres`.

Correctness is read from `store.session('response')`, where `1` means correct and `0` means incorrect.

When a response is incorrect, the consecutive-correct counter resets to `0`.

## Stage 2: Timed Adaptive Stage

Stage 2 uses:

- Corpus: `corpusAll`.
- Presentation time: 350 ms, inherited from `config.timing.stimulusTime`.
- Item selection: `mfi`.
- CAT update: standard adaptive CAT update.

The stage continues until the total test trial count reaches 84.

## Early Stop Rule

If the run is still in stage 1 at trial 30 and `cat.theta < -5`, the run stops early.

Decision details:

- The stop is checked after the trial response and CAT update.
- The stop is only active during stage 1.
- Stage 2 does not start after this rule is triggered.
- Countdown screens are suppressed after early stop so the participant does not see another `3, 2, 1` sequence before the task ends.
- The trial-30 threshold is stored on `config.adaptiveTiming.earlyStopNumItems` and is also used as this mode's validity `minResponsesRequired`.
- The theta threshold is stored on `config.adaptiveTiming.earlyStopThetaThres`.
- Other modes keep the existing validity `minResponsesRequired` value of 40.

## Break Schedule

`adaptiveTimingMultiStage` follows the same evenly spaced 84-trial break rhythm as `shortAdaptive`.

For 84 trials, the conceptual short-adaptive blocks are 28, 28, and 28 trials. Breaks occur at:

- Trial 14: mid-block break 1.
- Trial 28: post-block break 1.
- Trial 42: mid-block break 2.
- Trial 56: post-block break 2.
- Trial 70: mid-block break 3.

There is no post-block break after trial 84 because the final page follows the assessment.

## Transition Break

When the run transitions from stage 1 to stage 2, it shows an extra post-block break before continuing.

Decision details:

- The extra transition break uses `postBlockPageList[0]`.
- This transition break is independent of the regular 84-trial break schedule.
- It is shown only once, tracked by `adaptiveTimingTransitionBreakShown`.
- After the transition break, the countdown is shown only if trials remain.

## Trial Counting

The variant uses the existing test-trial counters:

- `trialNumTotal` starts at `1`.
- Each completed test trial increments `trialNumTotal`.
- The run continues while `trialNumTotal <= config.numAdaptive`.
- For this variant, `numAdaptive` defaults to `84`.

Because `trialNumTotal` is incremented after each trial, the 84-trial cap means trial data are collected through `trialNumTotal === 84`, then the run stops before a trial 85 can begin.

## Session State

The variant adds these session keys:

- `adaptiveTimingConsecutiveCorrect`: number of consecutive correct responses in stage 1.
- `adaptiveTimingFirstStageComplete`: whether the transition criterion has been met.
- `adaptiveTimingStopEarly`: whether the stage-1 early-stop rule has fired.
- `adaptiveTimingTransitionBreakShown`: whether the one-time transition break has appeared.

These keys are initialized for all runs but only affect behavior inside the `adaptiveTimingMultiStage` timeline branch.

## Parameter Registration

`adaptiveTimingMultiStage` is registered as a valid `userMode` in `parameters.json`.

Its stimulus rule list is:

```js
adaptiveTimingMultiStage: ['mfi', 'mfi'];
```

The first entry applies to stage 1. The second entry applies to stage 2.

Its stimulus count list is represented as:

```js
adaptiveTimingMultiStage: [numAdaptive, 0];
```

The actual stage lengths are dynamic. This count list exists so the mode has config metadata, and its sum matches the 84-trial cap for future code that uses reduce-based total-trial calculations.

## Implementation Notes

The main implementation points are:

- `src/experiment/config/config.js`
  - Registers the user mode.
  - Sets default `numAdaptive` to 84.
  - Defines the adaptive timing transition and early-stop thresholds.
  - Initializes adaptive-timing session state.
- `src/experiment/experimentSetup.js`
  - Selects `corpusNewEasy` in stage 1.
  - Selects `corpusAll` in stage 2.
- `src/experiment/trials/stimulus.js`
  - Applies infinite presentation time in stage 1.
  - Updates `cat` during stage 1 for this variant.
  - Tracks consecutive correct responses.
  - Applies the transition and early-stop rules.
- `src/experiment/experiment.js`
  - Delegates adaptive timing timeline construction to `adaptiveTimingTimeline.js`.
- `src/experiment/adaptiveTimingTimeline.js`
  - Builds the dynamic two-stage timeline.
  - Exposes `createAdaptiveTimingBreakEvents()` for direct testing of break-schedule math.
  - Preserves the short-adaptive break cadence.
  - Adds the one-time transition break.
  - Suppresses countdowns when no adaptive-timing trials remain.
