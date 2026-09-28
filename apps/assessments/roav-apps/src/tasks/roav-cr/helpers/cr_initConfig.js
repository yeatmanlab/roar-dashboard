import _omitBy from "lodash/omitBy";
import _isNull from "lodash/isNull";
import _isUndefined from "lodash/isUndefined";
import { getAgeData, getGrade } from "@bdelab/roar-utils";
import i18next from "i18next";
import { ModeGame } from "../../shared/helpers/namingHelpers";
import { NAME_CORPUS_DEF } from "../../shared/helpers/loadCorpus";
import {
  NAME_CONFIG_BLOCK_DEF,
  NAME_CONFIG_STIM_DEF,
  NAME_CONFIG_QUEST_DEF,
  NAME_CONFIG_ET_DEF,
  SUBVAR_DEF,
} from "./cr_loadCorpus";
import { createFirekitShim } from "../../shared/helpers/firekitShim";
// import { makePid } from "../../shared/trials/userDataHelpers";

export const cr_initConfig = async (gameParams, userParams) => {
  const cleanParams = _omitBy(
    _omitBy({ ...gameParams, ...userParams }, _isNull),
    _isUndefined,
  );

  const selectModeGame = (modeGameIn, userMetadataIn) => {
    const gradeIn = getGrade(userMetadataIn.grade);
    let modeGameRes;
    if (modeGameIn === ModeGame.GAME) {
      modeGameRes = ModeGame.GAME;
    } else if (modeGameIn === ModeGame.STANDARD) {
      modeGameRes = ModeGame.STANDARD;
    } else {
      modeGameRes =
        gradeIn <= 5 || gradeIn === undefined
          ? ModeGame.GAME
          : ModeGame.STANDARD;
    }
    return modeGameRes;
  };

  const {
    // eslint-disable-next-line no-unused-vars
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
    nameConfigQuest,
    nameConfigEt,
    subvar,
    modeGame,
    // modeGameRes - set later
    setupShort,
    screenCalibrate,
    videoEnable,
    videoRecord,
    vdCalibrate,
    etCalibrate,
    etCalibrateCollect,
    etEnable,
    showGaze,
    debug,
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);
  if (language !== "en") {
    await i18next.changeLanguage(language);
  }

  const userMetadataCombined = { ...userMetadata, grade, ...ageData };
  cleanParams.modeGameRes = selectModeGame(modeGame, userMetadataCombined);

  const config = {
    pid: assessmentPid, // `eval${makePid(6)}$` - this is the way to skip PID with "pilot"
    userMetadata: userMetadataCombined,
    startTime: new Date(),
    firekit: createFirekitShim({ taskId: taskName }),
    taskName: taskName,
    corpusName: corpusName || NAME_CORPUS_DEF,
    modeGame: modeGame || "all",
    modeGameRes: "stand",
    nameConfigStim: nameConfigStim ?? NAME_CONFIG_STIM_DEF,
    nameConfigBlock: nameConfigBlock ?? NAME_CONFIG_BLOCK_DEF,
    nameConfigQuest: nameConfigQuest ?? NAME_CONFIG_QUEST_DEF,
    nameConfigEt: nameConfigEt ?? NAME_CONFIG_ET_DEF,
    subvar: subvar ?? SUBVAR_DEF,
    recruitment: recruitment || "school", // "lab-eval-1", "dev" - should be "school", can be "pilot" - requests PID,
    setupShort: setupShort || false,
    screenCalibrate: screenCalibrate || false,
    videoEnable: videoEnable || false,
    videoRecord: videoRecord || false,
    vdCalibrate: vdCalibrate ?? true,
    etEnable: etEnable ?? true,
    etCalibrate: etCalibrate ?? true,
    etCalibrateCollect: etCalibrateCollect ?? true,
    showGaze: showGaze || false,
    debug: debug || false,
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [
      key,
      config[key] ?? value,
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
