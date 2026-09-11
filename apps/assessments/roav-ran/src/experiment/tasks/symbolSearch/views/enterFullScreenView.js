import { initPageDiv } from '../helpers/viewHelpers';
import fullscreen_page from './enterFullScreen.html';
import { openFullscreen } from '../../shared/views/videoCapture';
import { cleanupDynamicScripts } from '../../shared/views/viewUtils';
import { unlockAudio } from '../helpers/viewHelpers';

export async function enterFullScreenView(slide) {
  const fullScreenHtml = fullscreen_page;
  const fullScreenPage = initPageDiv(fullScreenHtml);

  document.body.appendChild(fullScreenPage);

  document.getElementById('header-text').textContent = slide.prompt;
  document.getElementById('go-btn').textContent = slide.buttonText;

  //go into full screen and complete the page
  document.getElementById('go-btn').addEventListener('click', () => {
    openFullscreen();
    unlockAudio(); //sets the audio context once to avoid audio autoplay gesture issues in ipad
    document.dispatchEvent(new Event('pageComplete'));
  });

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        fullScreenPage.remove();
        if (typeof cleanupDynamicScripts === 'function') {
          cleanupDynamicScripts();
        }
        resolve();
      },
      { once: true },
    );
  });
}
