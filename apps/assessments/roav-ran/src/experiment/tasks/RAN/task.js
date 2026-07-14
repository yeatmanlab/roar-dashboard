import store from 'store2';
import { TRIAL_TYPE_TEST } from '../shared/contracts';
import { setupTestConfig } from './helpers';
import { instructionView, micFailView, practiceIntroView, RANView } from './views';
import { stopMediaStreams } from '../shared/views/videoCapture.js';
import { infoSlideView } from '../shared/views';
import { configureDeviceView, calibrationView } from '../shared/views';
import { checkBoolean } from '../shared/helpers/helperFunctions.js';

class RANTask {
  constructor(config, audioMapping, gameParams) {
    this.config = config;
    this.audioMapping = audioMapping;
    this.gameParams = gameParams;
  }

  async init() {}

  async run() {
    await configureDeviceView(this.config);

    if (checkBoolean(this.gameParams.bEyeTracking)) {
      // TODO: Either refactor to match instructionView or the other way around
      await infoSlideView(
        [this.audioMapping.infoSlideView.welcome, this.audioMapping.infoSlideView.calibrationIntro],
        this.config,
      );

      await calibrationView(this.config);

      await infoSlideView(this.audioMapping.infoSlideView.calibrationEnd, this.config);
    } else {
      await infoSlideView([this.audioMapping.infoSlideView.welcome], this.config);
    }

    const instructionResult = await instructionView(this.audioMapping.instructionView, this.config);

    if (instructionResult.micFailed) {
      stopMediaStreams();
      await micFailView(this.audioMapping.micFailView, this.config);
      await this.config.firekit.updateEngagementFlags(['noAudioDetected'], false);
      await this.config.firekit.abortRun();
      // Signal aborted run to dashboard so run is not marked as completed
      return 'aborted';
    }

    await infoSlideView(this.audioMapping.infoSlideView.guidedPracticeLetters, this.config);

    const allTestConfigs = setupTestConfig();
    const subtestOrder = this.audioMapping.subtestOrder;

    for (let i = 0; i < subtestOrder.length; i++) {
      const testType = subtestOrder[i];
      store.session.set('testConfig', allTestConfigs[testType]);

      let practiceStim;
      let ranAssets;

      if (testType === 'Letters') {
        practiceStim = {
          assets: this.audioMapping.practiceView.letter,
          stimulusDir: 'https://storage.googleapis.com/roav-ran/shared/Letters',
        };

        ranAssets = this.audioMapping.ranView.letter;
      } else {
        practiceStim = {
          assets: this.audioMapping.practiceView.number,
          stimulusDir: 'https://storage.googleapis.com/roav-ran/shared/Numbers',
        };

        ranAssets = this.audioMapping.ranView.number;
      }

      await practiceIntroView(practiceStim, this.config);

      await RANView('Practice', this.config, ranAssets.practiceIntro);

      await RANView(TRIAL_TYPE_TEST, this.config, ranAssets.testIntro);

      // Show the transition slide between subtests (not after the last one)
      if (i < subtestOrder.length - 1 && testType === 'Letters') {
        await infoSlideView(this.audioMapping.infoSlideView.guidedPracticeNumbers, this.config);
      }
    }

    await infoSlideView(this.audioMapping.infoSlideView.assessmentEnd, this.config);
  }
}

export default RANTask;
