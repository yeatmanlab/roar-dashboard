import { fetchAndParseCorpus } from './helpers/initCorpus';
import { initStore } from './helpers/initStore';
import { infoSlideView } from '../shared/views';
import { infoSlideLongView } from './views/infoSlideLongView';
import { instructionSlideView } from './views/instructionSlideView';
import { symbolView, endSymbolView } from './views/symbolTestView';
import { symbolPracticeView, endPracticeSymbolView } from './views/symbolPracticeView';
import { enterFullScreenView } from './views/enterFullScreenView';
import { countDownView } from './views/countDown';
import { openFullscreen } from '../shared/views/videoCapture';
import store from 'store2';
import i18next from 'i18next';

class symbolSearchTask {
  constructor(config, audioMapping, gameParams) {
    this.config = config;
    this.audioMapping = audioMapping;
    this.gameParams = gameParams;
  }

  async init() {}

  async run() {
    //initialise store
    initStore();

    //generate corpus
    let corpus = await fetchAndParseCorpus(this.config);

    //click to go into full screen if not already
    await enterFullScreenView(this.audioMapping.enterFullScreenView);

    //intro
    await infoSlideView(this.audioMapping.infoSlideView.welcome[store.session.get('device')], this.config);

    //instructions: You will see some symbols. You need to select the symbol that matches the symbol on the left.
    await instructionSlideView(corpus['instruction'][0], this.audioMapping);

    //practice intro
    await infoSlideView(this.audioMapping.infoSlideView.practiceIntro[store.session.get('device')], this.config);

    //practice trials
    for (let i = 0; i < corpus['practice'].length; i++) {
      await symbolPracticeView(this.config, corpus['practice'][i], i, this.audioMapping);
    }
    store.session.set('trialNumTotal', 0);
    await endPracticeSymbolView();

    //test trials
    for (let blockIdx = 0; blockIdx < store.session.get('numBlocks'); blockIdx++) {
      //pre block instructions
      await infoSlideLongView(this.audioMapping.infoSlideLongView.preTasks[blockIdx]);

      //go into full screen before block of trials start
      openFullscreen();

      await countDownView();

      //sequence of trials
      let corpusIdx = 0;
      while (!store.session.get('timeOut') && corpusIdx < corpus['stimulus'][blockIdx].length) {
        await symbolView(this.config, corpus['stimulus'][blockIdx][corpusIdx], corpusIdx, blockIdx, this.audioMapping);
        corpusIdx++;
      }

      //clear timers
      clearInterval(store.session.get('intervalId'));
      clearTimeout(store.session.get('timerId'));
      clearTimeout(store.session.get('timerForceId'));

      //reinit store variables
      store.session.set('timerId', null);
      store.session.set('timerForceId', null);
      store.session.set('timeOut', false);
      store.session.set('startTimePB', null);

      await endSymbolView();
    }

    //ending screen
    await infoSlideLongView(this.audioMapping.infoSlideLongView.assessmentEnd);
  }
}

export default symbolSearchTask;
