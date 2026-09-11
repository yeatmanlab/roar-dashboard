import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import { PageAudioHandler } from './audioHandler';
import { taskStore } from '../../../taskStore';
import { getKeyboardChoices } from './getKeyboardChoices';

// Re-exported so existing import sites (afcStimulus, helpers barrel) are unaffected.
export { getKeyboardChoices };

function enableBtns(btnElements: NodeListOf<HTMLButtonElement>) {
  btnElements.forEach((btn) => (btn.disabled = false));
}

export function addKeyboardListeners(stim: StimulusType, isTouchScreen: boolean, itemConfig: LayoutConfigType) {
  const practiceBtns: NodeListOf<HTMLButtonElement> = document.querySelectorAll('.practice-btn');
  let keyboardFeedbackHandler: (ev: KeyboardEvent) => void;

  practiceBtns.forEach((btn, i) =>
    btn.addEventListener('click', async (e) => {
      handleKeyboardPracticeBtn(btn, stim, practiceBtns, false, i, itemConfig);
    }),
  );

  if (!isTouchScreen) {
    keyboardFeedbackHandler = (e: KeyboardEvent) => keyboardBtnFeedback(e, practiceBtns, stim, itemConfig);
    document.addEventListener('keydown', keyboardFeedbackHandler);

    return keyboardFeedbackHandler;
  }
}

async function keyboardBtnFeedback(
  e: KeyboardEvent,
  practiceBtns: NodeListOf<HTMLButtonElement>,
  stim: StimulusType,
  itemConfig: LayoutConfigType,
) {
  const allowedKeys = getKeyboardChoices(itemConfig);
  const index = allowedKeys.findIndex((f) => f === e.key);

  if (allowedKeys.includes(e.key)) {
    const btnClicked = practiceBtns[index];

    if (btnClicked) {
      handleKeyboardPracticeBtn(btnClicked, stim, practiceBtns, true, e.key.toLowerCase(), itemConfig);
    }
  }
}

function handleKeyboardPracticeBtn(
  btn: HTMLButtonElement,
  stim: StimulusType,
  practiceBtns: NodeListOf<HTMLButtonElement>,
  isKeyBoardResponse: boolean,
  responseValue: string | number,
  itemConfig: LayoutConfigType,
) {
  const index = Array.prototype.indexOf.call(practiceBtns, btn);
  const choices = itemConfig.response?.values || [];
  const choice = choices[index];
  const isCorrectChoice = choice?.toString() === stim.answer?.toString();
  let feedbackAudio;

  if (isCorrectChoice) {
    btn.classList.add('success-shadow');
    feedbackAudio = mediaAssets.audio.feedbackGoodJob;
    setTimeout(
      () =>
        jsPsych.finishTrial({
          response: choice,
          incorrectPracticeResponses: taskStore().incorrectPracticeResponses,
          button_response: !isKeyBoardResponse ? responseValue : null,
          keyboard_response: isKeyBoardResponse ? responseValue : null,
        }),
      1000,
    );
  } else {
    btn.classList.add('error-shadow');
    feedbackAudio = mediaAssets.audio.feedbackTryAgain;
    // jspysch disables the buttons for some reason, so re-enable them
    setTimeout(() => enableBtns(practiceBtns), 500);

    const incorrectPracticeResponses = taskStore().incorrectPracticeResponses;
    incorrectPracticeResponses.push(choice);
    taskStore('incorrectPracticeResponses', incorrectPracticeResponses);
  }
  // if there is audio playing, stop it first before playing feedback audio to prevent overlap between trials
  PageAudioHandler.stopAndDisconnectNode();
  PageAudioHandler.playAudio(feedbackAudio);
}
