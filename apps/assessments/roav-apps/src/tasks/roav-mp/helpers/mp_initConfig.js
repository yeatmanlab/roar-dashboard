import _omitBy from 'lodash/omitBy'; // returns object if predicate does not return true
import _isNull from 'lodash/isNull'; // checks if value of object is null
import _isUndefined from 'lodash/isUndefined'; // check if value of object is undefined
import { getAgeData, getGrade } from '@bdelab/roar-utils'; // restructures age information
import i18next from 'i18next'; // for language info
import { ModeGame, ModeSeq } from '../../shared/helpers/namingHelpers';
import { DOT_LIFE_DEFAULT } from '../trials/mp_rdk';
import { NAME_CORPUS_DEF } from '../../shared/helpers/loadCorpus';
import { createFirekitShim } from '../../shared/helpers/firekitShim';

// gets the variables required for the task
export const mp_initConfig = async (gameParams, userParams) => {
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
    dotlife,
    modeSeq,
    modeGame,
    // audio,
    // game,
    // responseMode,
    // modeGameRes - set later
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);
  // if language is not english then the language is changed and set once again
  if (language !== 'en') {
    await i18next.changeLanguage(language);
  }

  const userMetadataCombined = { ...userMetadata, grade, ...ageData };
  cleanParams.modeGameRes = selectModeGame(modeGame, userMetadataCombined);

  // sets default values for some that are not assigned
  const config = {
    pid: assessmentPid,
    userMetadata: userMetadataCombined,
    startTime: new Date(),
    firekit: createFirekitShim(),
    taskName: taskName,
    corpusName: corpusName || NAME_CORPUS_DEF,
    modeGame: modeGame || 'all',
    modeGameRes: cleanParams.modeGameRes,
    dotlife: dotlife ?? DOT_LIFE_DEFAULT, // dot life for RDK trials
    modeSeq: modeSeq ?? ModeSeq.FIXED,

    recruitment: recruitment || 'school',
    // responseMode: responseMode || "production",
    // game: game || false,
    // audio: audio ?? true,
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key] ?? value]),
  );
  // firekit is also updated
  await config.firekit.updateTaskParams(updatedGameParams);

  if (config.pid !== null) {
    await config.firekit.updateUser({
      assessmentPid: config.pid,
      ...userMetadata,
    });
  }

  return config;
};
