# ROAV-RAN

## Overview

ROAV-RAN is a modular JavaScript-based framework for running RAN-like assessments. The application begins at `src/experiment/index.js`, which manages and calls the various views that control different aspects of the test.

## Task Breakdown

### RAN

The Rapid Automatized Naming (RAN) assessment presents an individual with a series of stimuli arranged in a grid (typically 5 by 10) and asks them to name each item out loud as quickly and accurately as possible. These stimulus arrays for this app consist of either letters or numbers. RAN requires that individuals to both identify and name the items contained within the stimulus array and thereby serve to measure automaticity in visual, phonological, and linguistic cognitive processes, as well as the integration of these systems.

To run this task, specify `taskName=symbol-search` in the query string parameters or in the variant configuration. If a `taskName` is not specified then RAN is the default task.

### Symbol Search

The Symbol Search assessment is a 2 minute timed test for measuring processing speed based off of the WISC-V Symbol Search task. The stimulus is a pseudo letter (aka symbol) that is presented on the left side of the screen. The choices are a set of 7 pseudo letters that are presented in a row to the right side of the stimulus. Participants scan the choices until they find the stimulus letter or "matching symbol". Participants are instructed to complete as many trials as they can within the 2 minute time period.

The set of 7 letters are fixed and were selected to be visually distinguishable. Target positions are randomly sampled to be approximately uniform. The choices are randomly shuffled for each trial. A pool of items are randomly generated at runtime and it is controlled that consecutive trials do not have the same target position or target letter. The task is split into two 1-minute blocks. There is no difference between the two blocks. For each block a pool of 100 items are generated.

To run this task, specify `taskName=symbol-search` in the query string parameters or in the variant configuration.

## Structure

Each view is a separate JavaScript file located in the `views` folder. These views handle different parts of the experiment, from consent collection to calibration and the main RAN assessment. Below is a overview of each view and its purpose.

### Views Breakdown

#### RAN Views

##### Instruction View

- **File:** `src/experiment/tasks/RAN/views/instructionView.js`
- **Description:** Provides the user with scaffolded instructions on how to complete the RAN assessment. This stage presents a single letter and instructs the user to say the letter name (not the sound) before having the user complete two practice letters.

##### Practice Intro View

- **File:** `src/experiment/tasks/RAN/views/practiceIntroView.js`
- **Description:** Present an additional practice phase where the lion reads each stimulus in the 2x3 grid one at a time, playing the corresponding audio file. The user is then prompted to practice with the 2x3 grid before the view transitions to the full practice phase showing the 3x3 practice grid.

##### RAN View

- **File:** `src/experiment/tasks/RAN/views/RANView.js`
- **Description:** The core RAN test, where participants perform the task.

##### Mic Fail View

- **File:** `src/experiment/tasks/RAN/views/micFailView.js`
- **Description:**

#### Symbol Search Views

##### Count Down

- **File:** `src/experiment/tasks/symbolSearch/views/countDown.js`
- **Description:** Presents a blank white screen with a countdown in the middle that goes 3..2..1.. Once the countdown finishes, the page completes.

##### Enter Full Screen View

- **File:** `src/experiment/tasks/symbolSearch/views/enterFullScreenView.js`
- **Description:** Shows a screen with a text and button in the middle. On clicking the button, the page enters full screen mode and the page completes.

##### Info Long Slide View

- **File:** `src/experiment/tasks/symbolSearch/views/infoSlideLongView.js`
- **Description:** This view is identical to Info Slide View except it adds some additional paragraph text below the header tag. This allow slightly lengthier description/instruction.

##### Instruction Slide View

- **File:** `src/experiment/tasks/symbolSearch/views/instructionSlideView.js`
- **Description:** Instructions designed for the symbol search task. In this view, the left side stimulus appears first on the screen, then the choices appear on the right, and then the participant is prompted to click the matching symbol. An audio tone plays as feedback for correct and incorrect clicks. The page completes only when the matching symbol has been clicked.

##### Symbol Practice View

- **File:** `src/experiment/tasks/symbolSearch/views/symbolPracticeView.js`
- **Description:** Practice trials for symbol search task. An item is shown on the screen. Feedback is provided for each incorrect click. On the 3rd incorrect click, the correct symbol is indicated visually. The page completes only when the matching symbol has been clicked.

##### Symbol Test View

- **File:** `src/experiment/tasks/symbolSearch/views/symbolTestView.js`
- **Description:** Test trials for symbol search task. This view will build the page once at the first trial. Then in each successive trial, the images are replaced according to the current item. There is a time bar at the top of the screen that updates continuously. An audio tone is provided as feedback for each button click. The trial advances only when the correct button is clicked. All button clicks are recorded. All buttons are clickable but only the correct button fires the event to complete the trial.

#### Shared Views

##### Consent View

- **File:** `src/experiment/tasks/shared/views/consentView.js`
- **Description:** Displays the consent form. Participants must accept before proceeding to the next step.

##### Configure Device View

- **File:** `src/experiment/tasks/shared/views/configureDeviceView.js`
- **Description:** Requests camera (and/or microphone) access, ensures proper seating position, and allows configuration of device details such as screen size.

##### Info Slide View

- **File:** `src/experiment/tasks/shared/views/infoSlideView.js`
- **Description:**: Displays various instructions and task descriptions, along with optional audio playback. The content of these views can be customized by passing a `JSON` object while initializing the view.

##### Calibration View

- **File:** `src/experiment/tasks/shared/views/calibrationView.js`
- **Description:** Displays a blue stimulus for eye tracking calibration. A FaceMesh model first identifies major landmarks, which are then passed into a YOLO model to generate gaze predictions. These predicted x and y coordinates are then fine-tuned for each participant using simple linear regression models to generate final estimates of gaze position.

##### Preload View

- **File:** `src/experiment/tasks/shared/views/preloadView.js`
- **Description:** A blank screen that preloads files into cache to optimize performance.

## View Structure

Each view follows a consistent structure to maintain modularity and ease of testing. For example, `configureDeviceView` consists of three main components:

1. **HTML File:** Defines the layout and styling of the view, as well as some JavaScript functionality.
2. **JavaScript File:** Contains the logic for user interaction and view functionality.
3. **View Loader (views.js):** Loads the corresponding HTML and JavaScript files, initializes a wrapper `div`, and injects it into the document body.

### View Lifecycle

- A view starts by creating a container `div`.
- It loads the necessary HTML and JavaScript files.
- The `div` is added to `document.body`.
- The view ends when a resolve flag is triggered (e.g., a button click or programmatic completion of a task).

## Design Philosophy

The structure was designed to be highly modular, allowing for easy swapping and modification of different views during the testing phase. While some aspects could be streamlined further, refactoring will only take place once the test design is finalized and stable.

## Eye Tracking

There are a few pertinent files related to handling eye-tracking functionality. These include `videoCapture.js`, `headeyetracking.js`, and `eyetrackingVars.html`.

### Video Capture

- **File:** `videoCapture.js`
- **Description:** Contains functions to start and stop the camera. This is essential as it is the first step in running the eye tracking model, which ingests webcam feeds.

### Head and Eye Tracking

- **File:** `headeyetracking.js`
- **Description:** Processes the webcam feed and passes it into the eye tracking model to predict x, y coordinates of gaze.

### Eye Tracking Variables

- **File:** `eyetrackingVars.html`
- **Description:** Initializes global variables needed to run the eye tracking model, such as `leftEyeCoordinates` and `rightEyeCoordinates`, which store the model's predictions. It also initializes FaceMesh (a Google product) to track the face and crop the eyes before passing them into the eye-tracking model. This file also initializes a web worker that handles inference on the video frames by passing it through the YOLO eye-tracking model saved in the file `eyetracking_google.onnx`.
