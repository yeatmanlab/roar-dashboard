# shortAdaptive Design Documentation

## Overview

`shortAdaptive` is the default short-form adaptive SWR user mode. It presents a capped adaptive assessment using validated item-bank stimuli, MFI item selection, and the standard SWR timing and break structure.

The default run length is 84 test trials.

## Goals

- Provide a shorter adaptive assessment than the full-length modes.
- Use validated item-bank stimuli for primary ability estimation.
- Select items adaptively with MFI.
- Keep breaks evenly distributed through the 84-trial run.
- Use the standard 350 ms stimulus presentation time.
- Preserve compatibility with the shared SWR scoring, validity, and trial-writing pipeline.

## Trial Count

`shortAdaptive` defaults to:

```js
numAdaptive: 84;
```

The trials are divided into three blocks by `getStimulusCount()`:

```js
shortAdaptive: [28, 28, 28];
```

This is computed by dividing `numAdaptive + numNew` across three blocks. For `shortAdaptive`, `numNew` is currently `0`, so the three blocks are evenly sized.

## Item Selection

The stimulus rule list is:

```js
shortAdaptive: ['mfi', 'mfi', 'mfi'];
```

Each block uses MFI selection through `cat.findNextItem()`.

## Corpus

During normal `shortAdaptive` trials, items are selected from `corpusAll`.

The implementation uses `checkRealPseudo()` before each item selection to choose between:

- `corpus_real`
- `corpus_pseudo`

The chosen item is removed from the relevant corpus list after selection so it is not reused in the same run.

## Timing

`shortAdaptive` uses the standard test timing:

- Stimulus presentation time: 350 ms.
- Fixation time: 1000 ms.
- Trial duration: unlimited, represented by `null`.

The 350 ms presentation time comes from:

```js
config.timing.stimulusTime;
```

## Break Schedule

The 84 trials are divided into three 28-trial blocks. Each block is split into two halves, so mid-block breaks occur halfway through each block.

For the default 84-trial run, breaks occur at:

- Trial 14: mid-block break 1.
- Trial 28: post-block break 1.
- Trial 42: mid-block break 2.
- Trial 56: post-block break 2.
- Trial 70: mid-block break 3.

There is no post-block break after trial 84 because the final page follows the assessment.

Each half-block is preceded by the standard countdown.

## CAT Updates

After each test response, `shortAdaptive` updates:

- `cat`: primary adaptive estimate.
- `cat2`: secondary estimate that is updated whenever IRT parameters are present.

The primary `cat` estimate is updated for validated item-bank items. `corpusNew` and `en-corpusNew-easy` items are excluded from the primary `cat` update in the shared stimulus logic.

## Trial Data

Each test trial writes the standard SWR fields, including:

- Block index.
- Corpus ID.
- Word.
- Correctness.
- Correct response.
- Response input type.
- Real or pseudo label.
- Difficulty.
- `thetaEstimate` and `thetaSE`.
- `thetaEstimate2` and `thetaSE2`.
- Stimulus rule.
- Total and block trial counters.
- Presentation time.

## Progress Bar

Progress is incremented by:

```js
1 / sum(config.stimulusCountList);
```

For the default `shortAdaptive` run, this is `1 / 84` per test trial.

## Session State

`shortAdaptive` uses the shared SWR session counters:

- `currentBlockIndex`: current adaptive block.
- `trialNumBlock`: trial position within the current block.
- `trialNumTotal`: trial position within the full test run.
- `nextStimulus`: selected stimulus for the next test trial.
- `response`: correctness value for the latest response.
- `currentTrialCorrect`: boolean correctness value for the latest response.

## Parameter Registration

`shortAdaptive` is a valid `userMode` in `parameters.json`.

It is also the default `userMode` in `initConfig()` when no mode is provided.

## Implementation Notes

The main implementation points are:

- `src/experiment/config/config.js`
  - Sets `shortAdaptive` as the default user mode.
  - Sets default `numAdaptive` to 84.
  - Registers the three MFI selection rules.
  - Computes the three 28-trial blocks.
- `src/experiment/experimentSetup.js`
  - Selects stimuli from `corpusAll`.
  - Uses `checkRealPseudo()` to balance real and pseudo item availability.
  - Calls `cat.findNextItem()` with the current block's MFI rule.
- `src/experiment/trials/stimulus.js`
  - Applies standard 350 ms presentation time.
  - Updates CAT estimates after each response.
  - Writes standard trial metadata.
- `src/experiment/experiment.js`
  - Builds the three-block timeline.
  - Splits each block into two halves.
  - Inserts countdown, mid-block breaks, and post-block breaks.
