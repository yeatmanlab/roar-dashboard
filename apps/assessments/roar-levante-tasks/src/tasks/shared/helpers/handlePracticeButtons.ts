import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import { PageAudioHandler } from './audioHandler';
import { taskStore } from '../../../taskStore';

type PracticeFeedbackCallback = (onFeedbackEnded: () => void) => void;

let isFeedbackPlaying = false;

function enableBtns(btnElements: NodeListOf<HTMLButtonElement>) {
  btnElements.forEach((btn) => (btn.disabled = false));
}

function disableBtns(btnElements: NodeListOf<HTMLButtonElement>) {
  btnElements.forEach((btn) => {
    btn.disabled = true;
  });
}

function clearAudioOnEndedBeforeStop() {
  // Clear onended before stop so an interrupted clip cannot unlock early
  if (PageAudioHandler.audioSource) {
    PageAudioHandler.audioSource.onended = null;
  }
  PageAudioHandler.stopAndDisconnectNode();
}

export function addPracticeButtonListeners(
  answer: string,
  isTouchScreen: boolean,
  choices: string[],
  onCorrect?: PracticeFeedbackCallback,
  onIncorrect?: PracticeFeedbackCallback,
) {
  isFeedbackPlaying = false;
  const practiceBtns: NodeListOf<HTMLButtonElement> = document.querySelectorAll('.practice-btn');

  practiceBtns.forEach((btn, i) => {
    const eventType = isTouchScreen ? 'touchend' : 'click';

    btn.addEventListener(eventType, (e) => {
      handlePracticeButtonPress(btn, answer, practiceBtns, i, choices, onCorrect, onIncorrect);
    });
  });
}

function handlePracticeButtonPress(
  btn: HTMLButtonElement,
  answer: string,
  practiceBtns: NodeListOf<HTMLButtonElement>,
  responsevalue: string | number,
  choices: string[],
  onCorrect?: PracticeFeedbackCallback,
  onIncorrect?: PracticeFeedbackCallback,
) {
  if (isFeedbackPlaying) {
    return;
  }

  isFeedbackPlaying = true;
  disableBtns(practiceBtns);

  const index = Array.prototype.indexOf.call(practiceBtns, btn);
  const choice = choices[index];
  const isCorrectChoice = choice?.toString() === answer;

  // custom incorrect prompts by task
  const incorrectPromptKey =
    taskStore().task === 'mental-rotation' &&
    taskStore().heavyInstructions &&
    taskStore().nextStimulus?.trialType == '2D'
      ? 'mentalRotationFeedbackIncorrectDownex'
      : 'feedbackTryAgain';

  if (isCorrectChoice) {
    btn.classList.add('success-shadow');

    function finishTrial() {
      isFeedbackPlaying = false;
      jsPsych.finishTrial({
        response: choice,
        incorrectPracticeResponses: taskStore().incorrectPracticeResponses,
        button_response: responsevalue,
      });
    }

    setTimeout(
      finishTrial,
      onCorrect ? 3000 : 1000, // if callback is provided, give more time for callback to finish before ending trial
    );

    // if there is audio playing, stop it first before playing feedback audio to prevent overlap between trials
    clearAudioOnEndedBeforeStop();
    if (onCorrect) {
      onCorrect(() => {
        // Trial finish is still driven by the existing timeout so correct timing is preserved.
      });
    } else {
      PageAudioHandler.playAudio(mediaAssets.audio.feedbackGoodJob, {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
      });
    }
  } else {
    btn.classList.add('error-shadow');

    const incorrectPracticeResponses = taskStore().incorrectPracticeResponses;
    incorrectPracticeResponses.push(choice);
    taskStore('incorrectPracticeResponses', incorrectPracticeResponses);

    function unlockPracticeButtons() {
      isFeedbackPlaying = false;
      enableBtns(practiceBtns);
    }

    clearAudioOnEndedBeforeStop();

    if (onIncorrect) {
      onIncorrect(unlockPracticeButtons);
    } else {
      PageAudioHandler.playAudio(mediaAssets.audio[incorrectPromptKey], {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: unlockPracticeButtons,
      });
    }
  }
}
