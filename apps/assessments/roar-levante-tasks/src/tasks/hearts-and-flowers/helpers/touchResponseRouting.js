import { taskStore } from '../../../taskStore';
import { mediaAssets } from '../../..';
import { PageAudioHandler } from '../../shared/helpers';

// Reset each time a new view is set up so the audio plays once per screen
let hasPlayedToastAudioForView = false;

export function setupHafMultiResponseTouchRouting(
  buttonSelector = '.jspsych-html-multi-response-button',
  requireActive = false,
) {
  hasPlayedToastAudioForView = false;
  const toast = document.createElement('div');
  toast.id = 'lev-toast-default';
  toast.classList.add('lev-toast-default');
  toast.textContent = taskStore().translations.heartsAndFlowersClickReminder;
  if (!taskStore().inputCapability.touch) {
    document.body.appendChild(toast);
  }

  document.querySelectorAll(buttonSelector).forEach((wrapper) => {
    if (wrapper.dataset.hafTouchRouting === '1') return;
    wrapper.dataset.hafTouchRouting = '1';

    let syntheticClick = false;

    wrapper.addEventListener(
      'touchend',
      (e) => {
        if (e.touches.length > 0) return;
        if (e.cancelable) e.preventDefault();
        syntheticClick = true;
        wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        syntheticClick = false;
      },
      { passive: false },
    );

    wrapper.addEventListener(
      'click',
      (e) => {
        if (syntheticClick) return;
        if (!e.isTrusted) return;
        if (requireActive && !wrapper.dataset.hafActive) return;

        triggerToast();
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  });
}

let timeoutID;
function triggerToast() {
  if (taskStore().inputCapability.touch) {
    return;
  }

  const toast = document.getElementById('lev-toast-default');

  if (toast && !toast.classList.contains('show')) {
    toast.classList.add('show');

    if (!hasPlayedToastAudioForView) {
      hasPlayedToastAudioForView = true;

      const stopToastAudio = () => {
        PageAudioHandler.stopAndDisconnectNode();
        window.removeEventListener('keydown', stopToastAudio);
      };

      window.addEventListener('keydown', stopToastAudio);

      PageAudioHandler.playAudio(mediaAssets.audio.countdown3, {
        restrictRepetition: { enabled: false, maxRepetitions: 1 },
        onEnded: () => {
          window.removeEventListener('keydown', stopToastAudio);
          PageAudioHandler.playAudio(mediaAssets.audio.toastAlert, {
            restrictRepetition: { enabled: false, maxRepetitions: 1 },
            onEnded: () => {
              window.removeEventListener('keydown', stopToastAudio);
            },
          });
        },
      });
    }

    timeoutID = setTimeout(() => {
      if (toast) {
        toast.classList.remove('show');
      }
    }, 3000);
  } else if (toast && toast.classList.contains('show')) {
    clearTimeout(timeoutID);

    timeoutID = setTimeout(() => {
      if (toast) {
        toast.classList.remove('show');
      }
    }, 3000);
  }
}
