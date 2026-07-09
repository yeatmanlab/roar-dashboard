import _omitBy from "lodash/omitBy";
import _isNull from "lodash/isNull";
import _isUndefined from "lodash/isUndefined";
import i18next from "i18next";
import { getGrade } from "@bdelab/roar-utils";
import { stringToBoolean } from "../../shared/helpers";

const getStoryOption = (opt, grade) => {
  // opt can be "true", "false", "grade-based", or null
  // grade can be "prek", "k1", "k2"
  let story;

  // Function to safely convert a value to lowercase if it's a string
  var toLowerCaseSafe = (value) => {
    if (typeof value !== "string") {
      value = String(value); // Convert to string if not already a string
    }
    return value.toLocaleLowerCase();
  };

  // Safely convert opt to lowercase
  var optLowerCase = toLowerCaseSafe(opt);

  if (["true", "false"].includes(optLowerCase)) {
    story = stringToBoolean(optLowerCase);
  } else if (getGrade(grade) >= 6) {
    story = false;
  } else {
    story = true;
  }
  return story;
};

export const initConfig = async (
  firekit,
  gameParams,
  userParams,
  displayElement,
) => {
  const cleanParams = _omitBy(
    _omitBy({ ...gameParams, ...userParams }, _isNull),
    _isUndefined,
  );

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

  language !== "en" && i18next.changeLanguage(language);

  const config = {
    userMetadata: { ...userMetadata, grade },
    audioFeedback: audioFeedback || "neutral",
    skipInstructions: skipInstructions ?? true,
    startTime: new Date(),
    firekit,
    displayElement: displayElement || null,
    // name of the csv files in the storage bucket
    practiceCorpus: practiceCorpus ?? "math-item-bank-practice-pz",
    stimulusCorpus: stimulusCorpus ?? "math-item-bank-pz",
    sequentialPractice: sequentialPractice ?? true,
    sequentialStimulus: sequentialStimulus ?? true,
    buttonLayout: buttonLayout || "default",
    numberOfTrials: numberOfTrials ?? 10,
    task: taskName ?? "egma-math",
    stimulusBlocks: stimulusBlocks ?? 3,
    numOfPracticeTrials: numOfPracticeTrials ?? 2,
    storyOption,
    story: getStoryOption(storyOption, grade),
    keyHelpers: keyHelpers ?? true,
  };

  console.log("this is grade:", grade);

  console.log("this is storyOption:", storyOption);

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [
      key,
      key === "story" ? value : config[key] ?? value,
    ]),
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
