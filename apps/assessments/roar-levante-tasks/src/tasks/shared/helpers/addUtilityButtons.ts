import { pauseButtonSvg, playButtonSvg, exitButtonSvg, fullscreenButtonSvg, menuButtonSvg } from './components';
import { taskStore } from '../../../taskStore';
import { finalizeCurrentPauseSegment, getActiveTaskElapsedMs } from './appTimer';
import { InitPageSetup } from '../../../utils/initPageSetup';
import { jsPsych } from '../../taskSetup';
import { PageAudioHandler } from './audioHandler';

let pageSetup: InitPageSetup | null = null;
export function addExperimenterButtons() {
  // don't add if disabled or if they're already there
  if (document.querySelector('.experimenter-button-container') != null || !taskStore().experimenterButtons) {
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'experimenter-button-container';

  buttonContainer.innerHTML = `
        <button class="utility" id="menu" state="closed">
            ${menuButtonSvg}
        </button>
        <button class="utility transparent" id="exit" style="display: none;">
            ${exitButtonSvg}
        </button>
        <button class="utility transparent" id="pause" style="display: none;">
            ${pauseButtonSvg}
        </button>
    `;

  document.body.appendChild(buttonContainer);

  const pauseButton = document.getElementById('pause');
  pauseButton?.addEventListener('click', () => {
    onPause();
  });

  const exitButton = document.getElementById('exit');
  exitButton?.addEventListener('click', () => {
    onExit();
  });

  const menuButton = document.getElementById('menu');
  menuButton?.addEventListener('click', () => {
    onMenuPress(menuButton as HTMLButtonElement);
  });

  pageSetup = new InitPageSetup(4000, taskStore().translations);
  pageSetup.init();

  const popup = document.createElement('div');
  popup.id = 'exit-confirmation-popup';
  popup.classList.add('exit-confirmation-popup');
  popup.textContent = taskStore().translations.generalConfirmExit || 'Are you sure you want to exit the game?';
  popup.style.display = 'none';

  const popupButtonContainer = document.createElement('div');
  popupButtonContainer.id = 'exit-confirmation-popup-buttons';
  popupButtonContainer.classList.add('exit-confirmation-popup-buttons');
  popupButtonContainer.innerHTML = `
        <button class="primary small">${taskStore().translations.yes || 'Yes'}</button>
        <button class="primary small">${taskStore().translations.no || 'No'}</button>
    `;
  popup.appendChild(popupButtonContainer);

  // equalize button widths
  const popupButtons = popupButtonContainer.querySelectorAll('button');
  const standardWidth = popupButtons[0].getBoundingClientRect().width;
  popupButtons[0].style.width = standardWidth.toString() + 'px';
  popupButtons[1].style.width = standardWidth.toString() + 'px';

  document.body.appendChild(popup);
}

export function setupFullscreenButton() {
  const fullscreenButton = document.getElementById('fullscreen');
  fullscreenButton?.addEventListener('click', () => {
    onFullscreen();
  });

  document.addEventListener('fullscreenchange', () => {
    if (!fullscreenButton) {
      return;
    }

    if (document.fullscreenElement) {
      fullscreenButton.style.visibility = 'hidden';
    } else {
      fullscreenButton.style.visibility = 'visible';
    }
  });
}

function onPause() {
  if (taskStore().taskTimer != null) {
    clearTimeout(taskStore().taskTimer);
    taskStore('taskTimer', null);
  }
  taskStore('taskTimerPauseBeganAt', Date.now());

  pageSetup?.onPause();
  const playButton = document.getElementById('play-button');
  playButton?.addEventListener('click', () => {
    onResume();
  });

  PageAudioHandler.stopAndDisconnectNode();
  taskStore('isPaused', true);
}

function onResume() {
  taskStore('isPaused', false);

  finalizeCurrentPauseSegment();
  const maxTimeInMilliseconds = Math.max(Number(taskStore().maxTime), 1) * 60000;
  const remainingMs = Math.max(0, maxTimeInMilliseconds - getActiveTaskElapsedMs());
  const timerId = setTimeout(() => {
    taskStore('maxTimeReached', true);
    clearTimeout(timerId);
  }, remainingMs);
  taskStore('taskTimer', timerId);
  // re-enable all buttons
  const buttons = Array.from(document.querySelectorAll('button'));
  buttons.forEach((button: HTMLButtonElement) => {
    button.disabled = false;
  });

  // trigger replay button, which will repeat audio and animations
  PageAudioHandler.stopAndDisconnectNode();
  const replayButton = document.getElementById('replay-btn-revisited') as HTMLButtonElement;
  if (replayButton && !replayButton.disabled) {
    replayButton.click();
    replayButton.disabled = true;
  }
}

function onExit() {
  openPopup();

  const popupButtons = document.getElementById('exit-confirmation-popup-buttons')!.querySelectorAll('button');
  popupButtons[0].addEventListener('click', () => {
    document.body.innerHTML = '';
    taskStore('taskComplete', true);
    jsPsych.endExperiment();
  });
  popupButtons[1].addEventListener('click', () => {
    closePopup();

    const menuButton = document.getElementById('menu');
    const exitButton = document.getElementById('exit');
    const pauseButton = document.getElementById('pause');

    exitButton!.style.display = 'none';
    pauseButton!.style.display = 'none';

    menuButton!.classList.remove('open');
    menuButton!.setAttribute('state', 'closed');
  });
}

function onFullscreen() {
  if (document.fullscreenElement) {
    return;
  }

  document.documentElement.requestFullscreen().catch((err) => {
    console.error(`Error enabling fullscreen: ${err.message}`);
  });
}

function onMenuPress(menuButton: HTMLButtonElement) {
  const exitButton = document.getElementById('exit');
  const pauseButton = document.getElementById('pause');

  if (menuButton.getAttribute('state') === 'closed') {
    exitButton!.style.display = 'block';
    pauseButton!.style.display = 'block';

    menuButton!.classList.add('open');
    menuButton.setAttribute('state', 'open');
  } else {
    exitButton!.style.display = 'none';
    pauseButton!.style.display = 'none';

    menuButton!.classList.remove('open');
    menuButton.setAttribute('state', 'closed');
  }
}

function openPopup() {
  const popup = document.getElementById('exit-confirmation-popup');
  if (popup) {
    popup.style.display = 'block';
  }
}

function closePopup() {
  const popup = document.getElementById('exit-confirmation-popup');
  if (popup) {
    popup.style.display = 'none';
  }
}
