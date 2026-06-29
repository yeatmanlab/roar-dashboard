import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import { PageAudioHandler } from './audioHandler';
import { taskStore } from '../../../taskStore';

function enableBtns(btnElements: NodeListOf<HTMLButtonElement>) {
  btnElements.forEach((btn) => (btn.disabled = false));
}

export function addPracticeButtonListeners(
  answer: string,
  isTouchScreen: boolean,
  choices: string[],
  onCorrect?: () => void,
  onIncorrect?: () => void,
) {
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
  onCorrect?: () => void,
  onIncorrect?: () => void,
) {
  const index = Array.prototype.indexOf.call(practiceBtns, btn);
  const choice = choices[index];
  const isCorrectChoice = choice?.toString() === answer;

  const audioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: false,
      maxRepetitions: 2,
    },
  };

  // custom incorrect prompts by task
  const incorrectPromptKey =
    taskStore().task === 'mental-rotation' &&
    taskStore().heavyInstructions &&
    taskStore().nextStimulus?.trialType == '2D'
      ? 'mentalRotationFeedbackIncorrectDownex'
      : 'feedbackTryAgain';

  if (isCorrectChoice) {
    btn.classList.add('success-shadow');
    setTimeout(
      () =>
        jsPsych.finishTrial({
          response: choice,
          incorrectPracticeResponses: taskStore().incorrectPracticeResponses,
          button_response: responsevalue,
        }),
      onCorrect ? 3000 : 1000, // if callback is provided, give more time for callback to finish before ending trial
    );

    // if there is audio playing, stop it first before playing feedback audio to prevent overlap between trials
    PageAudioHandler.stopAndDisconnectNode();
    onCorrect ? onCorrect() : PageAudioHandler.playAudio(mediaAssets.audio.feedbackGoodJob, audioConfig);
  } else {
    btn.classList.add('error-shadow');
    // jspysch disables the buttons for some reason, so re-enable them
    setTimeout(() => enableBtns(practiceBtns), 500);

    let incorrectPracticeResponses = taskStore().incorrectPracticeResponses;
    incorrectPracticeResponses.push(choice);
    taskStore('incorrectPracticeResponses', incorrectPracticeResponses);

    PageAudioHandler.stopAndDisconnectNode();

    onIncorrect ? onIncorrect() : PageAudioHandler.playAudio(mediaAssets.audio[incorrectPromptKey], audioConfig);
  }
}
