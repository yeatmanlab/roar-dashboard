# roar-levante-tasks

This repository is a fork of [`levante-framework/core-tasks`](https://github.com/levante-framework/core-tasks), the core behavioral tasks for the LEVANTE framework, adapted for use in the ROAR assessment platform.

Item banks for all tasks are currently [here](https://docs.google.com/spreadsheets/d/1MlU4eOd45XVMg7HrnTDGZ3rv1cfNjvjpdc8e_edQqQk/edit?usp=sharing).

## Deprecation notice

> [!WARNING]
> This repository will be deprecated once `roar-levante-tasks` is migrated into the [`roar-dashboard`](https://github.com/yeatmanlab/roar-dashboard) monorepo. After migration, the monorepo becomes the source of truth and this fork will no longer be maintained. All future upstream syncing from `levante-framework/core-tasks` must happen within the monorepo — see [Post-migration](#post-migration-within-roar-dashboard-monorepo) for the correct process.

## Upstream sync

This fork tracks [`levante-framework/core-tasks`](https://github.com/levante-framework/core-tasks). Only a small number of upstream commits are relevant to ROAR — review each commit before pulling it in.

### Pre-migration (standalone repo)

```shell
# Add the upstream remote (first time only)
git remote add levante https://github.com/levante-framework/core-tasks.git

# Fetch latest upstream commits
git fetch levante

# Review what's new upstream since the last sync
git log levante/main --oneline

# Cherry-pick the commits you want, one at a time
git cherry-pick <commit-sha>

# Resolve any conflicts manually, then continue
git cherry-pick --continue
```

Open a PR against `main` when done. ROAR-specific files (`.github/`, config files, etc.) should generally be kept as-is when conflicts arise.

### Post-migration (within roar-dashboard monorepo)

Once migrated, `roar-levante-tasks` lives under `apps/assessments/roar-levante-tasks/`. Use `git format-patch` + `git am --directory` to replay upstream commits at the correct path — this is the monorepo equivalent of `git cherry-pick` and preserves commit authorship and messages.

> [!IMPORTANT]
> Do **not** use `git subtree pull` for upstream sync. It performs a bulk import of all upstream commits and will overwrite ROAR-specific changes.

```shell
# Add the upstream remote (first time only)
git remote add levante https://github.com/levante-framework/core-tasks.git

# Fetch latest upstream commits
git fetch levante

# Review what's new upstream since the last sync
git log levante/main --oneline

# For each commit you want to bring in:
git format-patch -1 <commit-sha> --stdout \
  | git am --directory=apps/assessments/roar-levante-tasks

# Resolve any conflicts manually, then continue
git am --continue
```

Open a PR against `main` in `roar-dashboard` when done.

## Running Locally

First, install Node.js and npm. Then from the repo root:

```shell
# install dependencies
npm install

# run the development server
npm run dev
```

You can now run tasks locally, e.g. TROG at `http://localhost:8080/?task=trog`.

Task parameters are documented in the [Current Tasks & Parameters](#current-tasks--parameters) section below.

## Architecture

The tasks are housed in a single repo using a monorepo-like structure. Which task runs is determined at runtime by query parameters (e.g. `?task=egma-math`). The app can run standalone as a web app or as an npm package.

### App code flow

_As a standalone web app_

```
serve.js -> index.js -> taskConfig.js -> load assets, corpus, setup store -> jsPsych timeline
```

_As an npm package_

```
host application -> index.js -> taskConfig.js -> load assets, corpus, setup store -> jsPsych timeline
```

### Build modes

The app uses two different build processes depending on the deployment target:

- **Standalone web app** — built with Webpack into `dist/`. Entry point is `serve/serve.js`.
- **npm package** — built with Rollup into `lib/`. Entry point is `src/index.ts`.

### TaskLauncher

The `TaskLauncher` class accepts `firekit`, `gameParams`, `userParams`, and an optional `displayElement`. In standalone mode, all parameters are read from query strings. As an npm package:

```js
import TaskLauncher from '@bdelab/roar-levante-tasks';

const task = new TaskLauncher(firekit, gameParams, userParams);
task.run();
```

### What is firekit?

[Firekit](https://github.com/yeatmanlab/roar-firekit) is an SDK developed by the ROAR team that provides streamlined interaction with Firestore and Firebase Authentication.

### Project structure

Task-specific code lives in `src/tasks/`, with each subdirectory named after its task. Common code shared across tasks lives in `src/utils/` and `src/taskStore/`. `taskConfig.js` is where everything comes together for a given task — it defines the config, global state, corpus loading, translations, and jsPsych timeline construction.

## Current Tasks & Parameters

In standalone web app mode, tasks and parameters are controlled via query strings.

### Common Parameters

> All tasks are timed. Defaults are listed below.

```
task: 'egma-math' | 'matrix-reasoning' | 'mental-rotation' | 'hearts-and-flowers' | 'memory-game' | 'same-different-selection' | 'theory-of-mind' | 'trog' [string] (optional)
age: [number] (optional)
audioFeedback: "neutral" [string] (optional) {Default: "neutral"}
skipInstructions: [boolean] (optional) {Default: true}
sequentialPractice: [boolean] (optional) {Default: true}
sequentialStimulus: [boolean] (optional) {Default: true}
corpus: "*task-name-here*-item-bank" [string] (optional) {Default: math-item-bank}
buttonLayout: "default" | "diamond" [string] (optional) {Default: "default"}
trials: [number] (optional)
stimulusBlocks: [number] (optional) {Default: 1}
numOfPracticeTrials: [number] (optional) {Default: 2}
maxIncorrect: [number] (optional) {Default: 3}
maxTime (minutes): [number] (optional) {Default: 100}
keyHelpers: [boolean] (optional) {Default: true}
storeItemId: [boolean] (optional) {Default: false}
pid: [string] (optional) {Default: random generated string}
```

### Task details

1. [Matrix Reasoning](https://roar-levante-tasks.web.app/?task=matrix-reasoning) — piloting 60 novel items from Rogier Kievit and Nicholas Judd; also using 80 Mars-IB items (Chierchia et al. 2020)

2. [Hearts & Flowers](https://roar-levante-tasks.web.app/?task=hearts-and-flowers) [EF: Inhibition] — 3.5 is the youngest you can go; 62 trials at ~2s/trial

3. [Memory Game (Corsi Block)](https://roar-levante-tasks.web.app/?task=memory-game) [EF: WM] — forward and backward block sequences from length 2–7; for ages < 5, assign forward block only

4. [Same-Different-Selection](https://roar-levante-tasks.web.app/?task=same-different-selection) [EF: Cognitive Flexibility] — progressive task combining FIST and Something's-the-Same trials (AMES lab)

5. [TROG](https://roar-levante-tasks.web.app/?task=trog) [Language: Grammar] — Test for Reception of Grammar (Bishop, 1982); 20 blocks of 4 items each

6. [Theory-of-Mind, Emotional Reasoning, and Hostile Attribution Battery](https://roar-levante-tasks.web.app/?task=theory-of-mind) [SocialCog]

7. [Math: EGMA + Multiplication + 4AFC Number Line](https://roar-levante-tasks.web.app/?task=egma-math) [Math: Symbolic Math] — 94 items total; at least 5 minutes

8. Number Line Estimation Task [Math: Approximate Math] — adaptive, age-based starting point

9. [Mental Rotation](https://roar-levante-tasks.web.app/?task=mental-rotation) [Visual-Spatial] — 2AFC match-to-sample; 120 items, nonadaptive (adaptive in progress)

10. [ROAR Vocab](https://roar-levante-tasks.web.app/?task=vocab) [Language: Vocab] — 3-minute adaptive version of the 10-minute full version

11. Child Survey — 5-point emoji-based valence scale; questions [here](https://docs.google.com/spreadsheets/d/1sOQv3qVwK-DQeAcySgNDCjR1TTl6_Ij-GDArM8nBeWk/edit?usp=sharing)

External tasks:

- MEFS (MN Executive Function Scale) [EF]
- [ROAR Single Word Reading](https://roar.education/) [Language: Single-word Reading]
- [ROAR Sentence Comprehension](https://roar.education/) [Language: Reading Comprehension]

## End-to-End Testing

Cypress is used for end-to-end testing. Tests live in `cypress/e2e/`.

```shell
# Ensure dependencies are installed
npm install

# Open Cypress
npx cypress open
```

## Data flow

[Data flow diagram](https://miro.com/app/board/uXjVNY-_qDA=/?share_link_id=967374624080)
