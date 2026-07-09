/*
1. Initialises session data.
2. Generates trial count for practice and stimulus blocks.
3. Sets the constant variables for the task in config.
4. Ensures data is written to firestore (firebase), adds event listener for errors.
5. Initialises the timeline, entering into fullscreen, getting consent/information from participant. Pid is generated randomly if not provided in form.
*/

import _omitBy from 'lodash/omitBy'; // returns object if predicate does not return true
import _isNull from 'lodash/isNull'; // checks if value of object is null
import _isUndefined from 'lodash/isUndefined'; // check if value of object is undefined
import { getAgeData, getGrade } from '@bdelab/roar-utils'; // restructures age information
import i18next from 'i18next'; // for language info
import { ModeGame } from '../../shared/helpers/namingHelpers';
import { NAME_CORPUS_DEF } from '../../shared/helpers/loadCorpus';
import { NAME_CONFIG_BLOCK_DEF, NAME_CONFIG_STIM_DEF } from './rvp_loadCorpus';

export const rvp_initConfig = async (firekit, gameParams, userParams) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const selectModeGame = (modeGameIn, userMetadataIn) => {
    const gradeIn = getGrade(userMetadataIn.grade);
    let modeGameRes;
    if (modeGameIn === ModeGame.GAME) {
      modeGameRes = ModeGame.GAME;
    } else if (modeGameIn === ModeGame.STANDARD) {
      modeGameRes = ModeGame.STANDARD;
    } else {
      modeGameRes = gradeIn <= 5 || gradeIn === undefined ? ModeGame.GAME : ModeGame.STANDARD;
    }
    return modeGameRes;
  };

  const {
    assessmentPid,
    recruitment,
    userMetadata = {},
    language = i18next.language,
    grade,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    taskName,
    corpusName,
    nameConfigStim,
    nameConfigBlock,
    modeGame,
    // modeGameRes - set later
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);
  if (language !== 'en') {
    await i18next.changeLanguage(language);
  }

  const userMetadataCombined = { ...userMetadata, grade, ...ageData };
  cleanParams.modeGameRes = selectModeGame(modeGame, userMetadataCombined);

  const config = {
    pid: assessmentPid,
    userMetadata: userMetadataCombined,
    startTime: new Date(),
    firekit,
    taskName: taskName,
    corpusName: corpusName || NAME_CORPUS_DEF,
    modeGame: modeGame || 'all',
    modeGameRes: cleanParams.modeGameRes,
    nameConfigStim: nameConfigStim ?? NAME_CONFIG_STIM_DEF,
    nameConfigBlock: nameConfigBlock ?? NAME_CONFIG_BLOCK_DEF,
    recruitment: recruitment || 'school',
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key] ?? value]),
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
