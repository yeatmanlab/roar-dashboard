import info_slide_page from './infoSlideLong.html';
import { cleanupDynamicScripts } from '../../shared/views/viewUtils.js';
import { initPageDiv, playAudioLong } from '../helpers/viewHelpers.js';
import store from 'store2';

const state = {
  currentAudio: null,
  currentAudioResolve: null,
};

export async function infoSlideLongView(audioMapping) {
  const infoSlidePage = initPageDiv(info_slide_page);

  // append the html to the document
  document.body.appendChild(infoSlidePage);

  populateScreen(audioMapping[store.session.get('device')], audioMapping.skippable);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        infoSlidePage.remove();
        cleanupDynamicScripts();
        resolve();
      },
      { once: true },
    );
  });
}

async function populateScreen(audioMapping, skippable) {
  document.querySelector('.header-text').innerHTML = audioMapping.header.text1 || '';
  document.getElementById('textAbove').innerHTML = audioMapping.header.text2 || '';
  document.getElementById('textBelow').innerHTML = audioMapping.footer.text || '';

  const wrapper = document.querySelector('.content-wrapper');
  if (!audioMapping.header.text2) {
    wrapper.classList.add('large-layout');
  } else {
    wrapper.classList.remove('large-layout');
  }

  const btn = document.querySelector('.next-button');
  btn.addEventListener('click', function () {
    //if any audio is playing when button is clicked then pause and reset it
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio = null;
      state.currentAudioResolve = null;
    }
    document.dispatchEvent(new Event('pageComplete'));
  });

  let headerSrc = audioMapping.header && audioMapping.header.audioSrc;
  let footerSrc = audioMapping.footer && audioMapping.footer.audioSrc;

  if (headerSrc || footerSrc) {
    btn.disabled = true;
  }

  if (skippable) {
    btn.disabled = false;
  }

  if (headerSrc) {
    await playAudioLong(audioMapping.header.audioSrc, state);
  }
  if (footerSrc) {
    await playAudioLong(audioMapping.footer.audioSrc, state);
  }

  btn.disabled = false;
}
