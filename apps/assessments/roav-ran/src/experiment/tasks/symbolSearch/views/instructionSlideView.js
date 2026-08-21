import instruction_slide_page from './instructionSlide.html';
import { cleanupDynamicScripts } from '../../shared/views/viewUtils.js';
import { initPageDiv, createStimulusImage, createChoices, playAudioLong } from '../helpers/viewHelpers.js';
import store from 'store2';

const state = {
  currentAudio: null,
  currentAudioResolve: null,
  interactionLocked: false,
};

export async function instructionSlideView(trial, audioMapping) {
  const instructionSlidePage = initPageDiv(instruction_slide_page);

  // append the html to the document
  document.body.appendChild(instructionSlidePage);

  populateSymbolRow(trial, instructionSlidePage, audioMapping);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        instructionSlidePage.remove();
        cleanupDynamicScripts();
        resolve();
      },
      { once: true },
    );
  });
}

function populateSymbolRow(trial, instructionSlidePage, audioMapping) {
  if (!trial) return;

  let imageRow = instructionSlidePage.querySelector('.image-row');

  imageRow.innerHTML = '';

  //add the target image
  imageRow.appendChild(createStimulusImage(trial.dir, trial.target, 'target-image'));

  const choices = Array.isArray(trial.choices) ? trial.choices : [];

  choices.forEach((choiceSrc, index) => {
    const button = createChoices(trial.dir, choiceSrc, 'hidden-choice');
    if (choiceSrc === trial.target) {
      button.dataset.target = 'true';
    }
    button.addEventListener('click', async () => {
      if (state.interactionLocked) return;

      //if any audio is playing when button is clicked then pause and reset it to play the feedback audio
      if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio = null;
        state.currentAudioResolve = null;
      }
      //if correct choice play positive feedback and complete the screen
      if (choiceSrc === trial.target) {
        await playAudioLong(audioMapping.positiveFeedbackSrc, state);
        document.dispatchEvent(new Event('pageComplete'));
      } else {
        //play negative audio if incorrect response
        await playAudioLong(audioMapping.negativeFeedbackSrc, state);
      }
    });
    imageRow.appendChild(button);
  });

  runInstructionSequence(audioMapping.instructionSlideView[store.session.get('device')], imageRow);
}

async function runInstructionSequence(audioMapping, imageRow) {
  //1st "screen" has target image and one sentence
  document.querySelector('.instruction-text').innerHTML = audioMapping.header.text1 || '';

  // this will be hidden, add it now so that content doesn't shift up
  document.getElementById('text-below').innerHTML = audioMapping.footer.text || '';

  await playAudioLong(audioMapping.header.audioSrc1, state);

  //2nd "screen" shows the choices, the corresponding instruction, and audio
  document.querySelector('.instruction-text').innerHTML = audioMapping.header.text2 || '';

  imageRow.querySelectorAll('.hidden-choice').forEach((btn) => btn.classList.remove('hidden-choice'));

  //control to ensure that buttons are not clickable until the audio completes
  state.interactionLocked = true;

  await playAudioLong(audioMapping.header.audioSrc2, state);

  //3rd screen: buttons are clickable now
  state.interactionLocked = false;

  //add the glowing button class to the target, show the footer text and play audio
  const targetBtn = imageRow.querySelector('[data-target="true"]');
  targetBtn?.classList.add('glowingButton');

  document.getElementById('text-below').classList.remove('hidden');

  await playAudioLong(audioMapping.footer.audioSrc, state);
}
