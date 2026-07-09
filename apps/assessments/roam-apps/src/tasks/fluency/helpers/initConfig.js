/*
1. Initialises session data.
2. Generates trial count for practice and stimulus blocks.
3. Sets the constant variables for the task in config.
4. Ensures data is written to firestore (firebase), adds event listener for errors.
5. Initialises the timeline, entering into fullscreen, getting consent/information from participant. Pid is generated randomly if not provided in form.
*/

import _omitBy from "lodash/omitBy"; //returns object if predicate does not return true
import _isNull from "lodash/isNull"; //checks if value of object is null
import _isUndefined from "lodash/isUndefined"; //check if value of object is undefined
import { getAgeData } from "@bdelab/roar-utils"; //restructures age information
import i18next from "i18next"; //for language info

//gets the variables required for the task
export const initConfigFluency = async (
  firekit,
  gameParams,
  userParams,
  displayElement,
) => {
  //concatenates gameparams and userparams (2 dictionaries?) and omits anything that is null or undefined
  const cleanParams = _omitBy(
    _omitBy({ ...gameParams, ...userParams }, _isNull),
    _isUndefined,
  );

  //none of the 'num' variables from gameParams is included, userMetadata, testingOnly, language are new variables that are not part of gameParams or userParams
  const {
    userMode,
    assessmentPid,
    labId,
    recruitment,
    userMetadata = {},
    consent,
    language = i18next.language,
    grade,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    //group,
    responseMode,
    taskName,
    corpusName,
    storyOption,
    keyboardPractice,
    audio,
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);
  //if language is not english then the language is changed and set once again
  language !== "en" && (await i18next.changeLanguage(language));

  //sets default values for some that are not assigned
  const config = {
    userMode: userMode || "default",
    pid: assessmentPid,
    labId: labId || "YeatmanLab",
    recruitment: recruitment || "pilot",
    userMetadata: { ...userMetadata, grade, ...ageData },
    consent: consent ?? false,
    totalTrialsMain: 10,
    stopCriterion: 3, //number of trials to get right to move on to next block
    startTime: new Date(),
    firekit,
    displayElement: displayElement || null,
    responseMode: responseMode || "production",
    taskName: taskName,
    corpusName: corpusName || "items",
    //group: group,
    storyOption: storyOption ?? false,
    keyboardPractice: keyboardPractice ?? true,
    audio: audio ?? true,
  };

  //updates game gameParams, maps values from config to gameParams
  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [
      key,
      config[key] ?? value,
    ]),
  );

  //firekit is also updated
  await config.firekit.updateTaskParams(updatedGameParams);

  if (config.pid !== null) {
    await config.firekit.updateUser({
      assessmentPid: config.pid,
      ...userMetadata,
    });
  }

  return config;
};
