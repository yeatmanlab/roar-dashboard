# SRE Variants

This document summarizes the currently supported SRE variants used most often for English testing. Variants are selected with the `mode` query parameter, which maps to `userMode` in the app configuration.

Example:

```text
?mode=90s2BlocksFixedForms
```

If no `mode` is supplied, the selected mode comes from language-specific defaults in `selectDefaultMode`.

- English (`en`) defaults to `3minBlock90sBlock`.
- Spanish (`es`) defaults to `90s2Blocks`.
- Portuguese (`pt`) defaults to `90s2Blocks`.
- German (`de`) defaults to `90s2Blocks`.

## `3min1Block`

`3min1Block` runs a single 3-minute test block.

Block selection:

- Randomly selects one form from `lab`, `aiV1P1`, or `aiV1P2`.
- The selected form is the only test block shown after practice.

Timing:

- One test block.
- Test block duration is 180,000 ms, or 3 minutes.

Scoring:

- Each subtask score starts as `numCorrect - numIncorrect`.
- If the selected block is `lab`, the composite `sreScore` is the lab `sreScore`, clipped at 0.
- If the selected block is `aiV1P1` or `aiV1P2`, the subtask `sreScore` remains raw and only the composite score is converted through `https://storage.googleapis.com/roar-sre/scores/sre_parallel_equating_lookup.csv`.
- The composite score is then matched to the configured SRE norm lookup table for reporting normed fields when available.

## `3minBlock90sBlock`

`3minBlock90sBlock` runs one 3-minute block followed by one fixed-form 90-second block.

Block selection:

- Randomly selects the first block from `lab`, `aiV1P1`, or `aiV1P2`.
- Randomly selects the second block from `corpus.fixedForms`.

Timing:

- Two test blocks.
- The first test block duration is 180,000 ms, or 3 minutes.
- The second test block duration is 90,000 ms, or 90 seconds.

Scoring:

- Each subtask score starts as `numCorrect - numIncorrect`.
- If the first block is `lab`, the composite `sreScore` is the lab `sreScore`, clipped at 0.
- If the first block is `aiV1P1` or `aiV1P2`, the subtask `sreScore` remains raw and only the composite score is converted through `https://storage.googleapis.com/roar-sre/scores/sre_parallel_equating_lookup.csv`.
- The fixed-form 90-second block is administered and reported as its own raw subtask, but the existing composite logic does not use it when the first block provides the composite score.
- The composite score is then matched to the configured SRE norm lookup table for reporting normed fields when available.

## `90s2Blocks`

`90s2Blocks` runs two 90-second test blocks.

Block selection:

- Runs `test1` and `test2`.
- The block order is shuffled for each run.
- Items come from randomized `test1` and `test2` corpora, not fixed ordered forms.
- Use `90s2BlocksFixedForms` when fixed-form blocks are needed.

Timing:

- Two test blocks.
- Each test block duration is 90,000 ms, or 90 seconds.

Scoring:

- Each subtask score starts as `numCorrect - numIncorrect`.
- For Spanish, Portuguese, and German, the composite `sreScore` is the sum of non-practice subtasks, clipped at 0.
- The composite score is then matched to the configured SRE norm lookup table for reporting normed fields when available.

## `90s2BlocksFixedForms`

`90s2BlocksFixedForms` runs two fixed-form 90-second blocks.

Block selection:

- Randomly selects two forms from `corpus.fixedForms`.
- English fixed forms are keyed as `fixedForm1`, `fixedForm2`, etc.

Timing:

- Two test blocks.
- Each test block duration is 90,000 ms, or 90 seconds.

Scoring:

- Each fixed-form raw score first starts as `numCorrect - numIncorrect`.
- The reported `sreScore` for each fixed-form subtask remains raw.
- The composite `sreScore` converts each fixed-form raw score through `https://storage.googleapis.com/roar-sre/scores/sre_parallel_90s_form_equating_lookup.csv` using both `rawScore` and `form`.
- The composite `sreScore` is the average of the two lookup-table fixed-form `sreScore`s.
- If the average is not an integer, it is rounded up with `Math.ceil`.
- The composite score is then matched to the configured SRE norm lookup table for reporting normed fields when available.
