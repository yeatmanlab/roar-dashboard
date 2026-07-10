import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import i18next from 'i18next';
import { getGrade } from '@bdelab/roar-utils';
import { stringToBoolean } from '../../shared/helpers';

export const initConfig = async (firekit, gameParams, userParams, displayElement) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    userMetadata = {},
    audioFeedback,
    grade,
    language = i18next.language,
    skipInstructions,
    practiceCorpus,
    stimulusCorpus,
    sequentialPractice,
    sequentialStimulus,
    buttonLayout,
    numberOfTrials,
    storyCorpus,
    taskName,
    stimulusBlocks,
    numOfPracticeTrials,
    storyOption,
    keyHelpers,
  } = cleanParams;

  language !== 'en' && i18next.changeLanguage(language);

  const config = {
    userMetadata: { ...userMetadata, grade },
    audioFeedback: audioFeedback || 'neutral',
    skipInstructions: skipInstructions ?? true,
    startTime: new Date(),
    firekit,
    displayElement: displayElement || null,
    // name of the csv files in the storage bucket
    practiceCorpus: practiceCorpus ?? '',
    stimulusCorpus: stimulusCorpus ?? '',
    sequentialPractice: sequentialPractice,
    sequentialStimulus: sequentialStimulus,
    buttonLayout: buttonLayout || 'default',
    numberOfTrials: numberOfTrials ?? 100,
    task: taskName,
    stimulusBlocks: stimulusBlocks ?? 1,
    numOfPracticeTrials: numOfPracticeTrials ?? 2,
    storyOption,
    story: null,
    keyHelpers: keyHelpers ?? true,
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, key === 'story' ? value : (config[key] ?? value)]),
  );

  await config.firekit.updateTaskParams(updatedGameParams);

  if (config.pid !== null) {
    await config.firekit.updateUser({
      assessmentPid: config.pid,
      ...userMetadata,
    });
  }

  return config;
};
