import { cleanupDynamicScripts } from '../../shared/views/viewUtils';

/* Helpers for symbol page initialization */

// creates an outer div and assigns html to it
export const initPageDiv = (screenHtml) => {
  const screenPage = document.createElement('div');
  screenPage.style.position = 'fixed';
  screenPage.style.width = '100%';
  screenPage.style.height = '100%';
  screenPage.style.alignItems = 'center';
  screenPage.style.justifyContent = 'center';
  screenPage.innerHTML = screenHtml;

  //use this later in place of vw in CSS
  const unit = window.innerWidth / 100;
  document.documentElement.style.setProperty('--u', `${unit}px`);
  return screenPage;
};

//initialises the symbol page when running a sequence of trials, this happens only once
export function ensureSymbolPage(state, text, symbol_trial, progress_value) {
  if (state.symbolPage) return Promise.resolve();
  state.symbolPage = initPageDiv(symbol_trial);

  // append the html to the document
  document.body.appendChild(state.symbolPage);

  //add the text for the progress bar
  document.getElementById('progress-bar-text').innerHTML = text;

  //initialise progress bar
  let percent = Math.round(progress_value * 100);
  document.querySelector('#jspsych-progressbar-inner').style.width = `${percent}%`;

  state.imageRow = state.symbolPage.querySelector('.image-row');
  state.bufferTime = progress_value;

  return Promise.resolve();
}

/* Helpers for trial and page completion */

//cleans up the symbol view page for both practice and test
export function endView(state) {
  if (!state.symbolPage) return;

  if (state.symbolPage.parentNode) {
    state.symbolPage.parentNode.removeChild(state.symbolPage);
  }

  state.symbolPage = null;
  state.imageRow = null;
  state.currentTrialResolve = null;

  if (typeof cleanupDynamicScripts === 'function') {
    cleanupDynamicScripts();
  }
}

// write data to firebase
export function completeTrial(state, config, results, save_trial) {
  try {
    if (save_trial && config && config.firekit && typeof config.firekit.writeTrial === 'function') {
      const toWrite = structuredClone(results);
      // start the async write but don't await it here; collect the promise
      const p = Promise.resolve()
        .then(() => config.firekit.writeTrial(toWrite))
        .catch((err) => {
          console.error('Failed to write trial to firekit:', err);
          throw err;
        });
      state.pendingWrites.push(p);
    }
  } catch (err) {
    console.error('Failed to queue trial write:', err);
  }

  if (typeof state.currentTrialResolve === 'function') {
    // resolve the promise returned by symbolView (no payload needed)
    state.currentTrialResolve();
    state.currentTrialResolve = null;
  }
}

// waits for any pending firekit writes
export function waitForPendingWrites(state) {
  if (state.pendingWrites.length === 0) return Promise.resolve();
  const writes = state.pendingWrites.slice();
  state.pendingWrites = [];
  return Promise.all(writes);
}

/* Helpers for creating stimulus buttons and images */

//get the preloaded image
const getPreloadedImageSrc = (url) => {
  return window._preloadedImageURLs?.get(url) ?? url;
};

//create the image element and assign source
const createPreloadedImage = (url) => {
  const preloaded = window._preloadedImages?.get(url);
  if (preloaded) {
    return preloaded.cloneNode(true);
  }
  const img = document.createElement('img');
  img.src = getPreloadedImageSrc(url);
  return img;
};

//creates the image which will be used for item and for the choices
export const createStimulusImage = (parentDir, choiceSrc, className) => {
  const url = `${parentDir}/${choiceSrc}`;
  const img = createPreloadedImage(url);
  img.alt = 'symbol';
  img.draggable = false;
  if (className) {
    img.className = className;
  }
  const isPreloaded = Boolean(window._preloadedImages?.get(url));
  if (!isPreloaded) {
    img.style.visibility = 'hidden';
  }

  if (!isPreloaded && img.decode) {
    img
      .decode()
      .catch(() => {})
      .finally(() => {
        img.style.visibility = 'visible';
      });
  }

  return img;
};

//Creates the button choices
export const createChoices = (parentDir, choiceSrc, className) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  //add image for the button
  const img = createStimulusImage(parentDir, choiceSrc);
  button.appendChild(img);

  //css active property does not work on ipad, so using event listeners to scale and show box shadow
  button.addEventListener('pointerdown', () => {
    button.classList.add('pressed');
  });

  button.addEventListener('pointerup', () => {
    setTimeout(() => {
      button.classList.remove('pressed');
    }, 100);
  });

  button.addEventListener('pointercancel', () => {
    button.classList.remove('pressed');
  });

  return button;
};

/* Helpers for playing audio feedback */

//getting the preloaded audio
const getPreloadedAudioSrc = (url) => {
  return window._preloadedAudioURLs?.get(url) ?? url;
};

// singleton, created once app-wide, ideally in your very first user-gesture handler
let sharedAudio = null;

// Create Audio once
export function unlockAudio() {
  if (sharedAudio) return;
  sharedAudio = new Audio();
  sharedAudio.play().catch(() => {}); // fails silently if src is empty, that's fine — just needs the gesture-tied play() call
  sharedAudio.pause();
}

// Longer audios that will be played out fully before next screen and which can be interrupted by button clicks
export function playAudioLong(url, state) {
  return new Promise((resolve) => {
    if (!url || !sharedAudio) {
      resolve();
      return;
    }

    // interrupt currently playing audio
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;

      // resolve previous pending promise
      if (state.currentAudioResolve) {
        state.currentAudioResolve();
      }
    }

    // clear any stale listeners before attaching new ones
    sharedAudio.onended = null;
    sharedAudio.onerror = null;

    //get the new audio
    sharedAudio.src = getPreloadedAudioSrc(url);
    sharedAudio.currentTime = 0;

    state.currentAudio = sharedAudio; // track the shared element
    state.currentAudioResolve = resolve;

    const cleanup = () => {
      if (state.currentAudio === sharedAudio) {
        state.currentAudio = null;
        state.currentAudioResolve = null;
      }
      resolve();
    };

    sharedAudio.onended = cleanup;
    sharedAudio.onerror = cleanup;
    sharedAudio.play().catch((err) => {
      console.error('Audio play blocked:', err.name, err.message);
      cleanup();
    });
  });
}

//Shorter audios that play in the background and do not get interrupted
export function playAudioShort(url) {
  if (!url) return;

  const src = getPreloadedAudioSrc(url);
  const audio = new Audio(src);
  audio.play().catch(() => {
    // ignore autoplay restrictions
  });
}
