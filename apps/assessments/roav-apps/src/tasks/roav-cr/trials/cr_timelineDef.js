import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { sessionGet, sessionSet } from "../../shared/helpers/sessionHelpers";
import { CR_SESSION_KEYS as SK } from "../helpers/cr_sessionKeys";
import { ET } from "../../et/et_constants";
import { CR, VALIDATION } from "../helpers/cr_constants";
import {
  AssessmentStage,
  NameTask,
  TypeSize,
  ModeGame,
  SubtypeTrial,
} from "../../shared/helpers/namingHelpers";
import { t_instructionTech } from "../../shared/trials/instructionTech";
import { t_cr, TypeSame, TypeSide, TypeTask } from "./cr_trial";
import { t_createBlockCr, t_setParamsBlockCr } from "./cr_block";
import {
  t_surveyRatingRadio,
  t_surveyText,
} from "../../shared/trials/surveyHelpers";
import {
  t_et_cameraConfirm,
  t_et_videoConfirm,
  t_et_videoEnable,
  t_et_videoStop,
} from "../../et/et_videoHelpers";
import { t_et_fmClose, t_et_fmInit } from "../../et/et_fmHelpers";
import { t_et_collectDataDeviceScreenWebcam } from "../../et/et_deviceHelpers";
import { t_et_vdCalibr, t_et_htCalibrPlayground } from "../../et/et_htHelpers";
import { DURATIONS, SCREEN } from "../../shared/helpers/constants";
import {
  et_TypeSaveSnapshots,
  state,
  t_et_stateFallbackDef,
  t_et_stateSave,
} from "../../et/et_state";
import { t_screenMeasureWidth } from "../../shared/trials/screenCalibrateHelpers";
import {
  t_et_etTest,
  t_et_etCalibr,
  t_et_etWorkerPreload,
  t_et_etWorkerStopFull,
} from "../../et/et_etHelpers";
import { t_et_imEye } from "../../et/et_imHelpers";
import {
  t_enterFullscreen,
  t_enterLandscape,
  t_exitFullscreen,
  t_installTouchGuards,
} from "../../shared/trials/screenHelpers";
import { t_setAllowModeInputAll } from "../../shared/trials/inputModeHelpers";
import { t_instructionGeneral } from "../../shared/trials/instructionGeneral";
import { t_collectDataMonitor } from "../../shared/trials/collectDataMonitor";
import { t_crCreateQuest } from "../helpers/cr_questHelpers";
import {
  t_initSummary,
  t_plotSummary,
} from "../../shared/trials/summaryHelpers";
import { t_saveConfigAll } from "../helpers/cr_crHelpers";
import {
  t_createValidityEvaluator,
  t_markAsCompletedValidation,
  t_startNewBlockValidation,
} from "../../shared/trials/validityHelpers";
import { t_crParams } from "./cr_params";

const includePlaygroundEt = false;
const includePlaygroundCr = false;
const includeTaskEval = false;
const includeTaskMain = true;

// used outside of PROTO path
const numTrialBlock = 12;
const numTrialBlockSlow = 3;
const durationFixSlow = 1500;
const durationStimSlow = 2000;

export const t_timelineDef = () => {
  const config = sessionGet(SK.CONFIG);
  const {
    videoEnable,
    videoRecord,
    setupShort,
    screenCalibrate,
    vdCalibrate,
    etCalibrate,
    etCalibrateCollect,
    etEnable,
    showGaze,
    debug,
  } = config;
  sessionSet(SK.VIDEO_ENABLE, videoEnable);
  sessionSet(SK.VIDEO_RECORD, videoRecord);
  sessionSet(SK.SCREEN_CALIBRATE, screenCalibrate);
  sessionSet(SK.VD_CALIBRATE, vdCalibrate);
  sessionSet(SK.ET_CALIBRATE, etCalibrate);
  sessionSet(SK.ET_CALIBRATE_COLLECT, etCalibrateCollect);
  sessionSet(SK.ET_ENABLE, etEnable);
  sessionSet(SK.SHOW_GAZE, showGaze);
  sessionSet(SK.DEBUG, debug);
  const includeDebug = debug;
  const showSummary = debug;

  const createMetaparamsDemoCustom = (
    typeTask,
    flagNoflank,
    typeSame,
    namesStim,
  ) => {
    if (typeTask === TypeTask.SHAPE_IDENT) {
      if (flagNoflank) {
        return {
          indTarg: namesStim.indexOf("butterfly"),
          _sideTarg: TypeSide.RIGHT,
        };
      }
      return {
        indTarg: namesStim.indexOf("car"),
        _sideTarg: TypeSide.LEFT,
      };
    }
    if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
      if (flagNoflank) {
        if (typeSame === TypeSame.DIFF) {
          return {
            indTargL: namesStim.indexOf("duck"),
            indTargR: namesStim.indexOf("tree"),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.DIFF,
          };
        }
        if (typeSame === TypeSame.SAME) {
          return {
            indTargL: namesStim.indexOf("butterfly"),
            indTargR: namesStim.indexOf("butterfly"),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.SAME,
          };
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (typeSame === TypeSame.DIFF) {
          return {
            indTargL: namesStim.indexOf("heart"),
            indTargR: namesStim.indexOf("car"),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.DIFF,
          };
        }
        if (typeSame === TypeSame.SAME) {
          return {
            indTargL: namesStim.indexOf("tree"),
            indTargR: namesStim.indexOf("tree"),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.SAME,
          };
        }
      }
    }
    return {};
  };

  const createArrMetaparamsPracticeAvCustom = (typeTask, flagNoflank) => {
    if (typeTask === TypeTask.SHAPE_IDENT) {
      if (flagNoflank) {
        return [
          { indTarg: 0, _sideTarg: TypeSide.LEFT },
          { indTarg: 3, _sideTarg: TypeSide.RIGHT },
        ];
      }
      return [
        { indTarg: 1, _sideTarg: TypeSide.RIGHT },
        { indTarg: 2, _sideTarg: TypeSide.LEFT },
        { indTarg: 0, _sideTarg: TypeSide.LEFT },
      ];
    }
    if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
      if (flagNoflank) {
        return [{ _same: TypeSame.DIFF }, { _same: TypeSame.SAME }];
      }
      return [
        { _same: TypeSame.SAME },
        { _same: TypeSame.DIFF },
        { _same: TypeSame.DIFF },
        { _same: TypeSame.SAME },
      ];
    }
    if (flagNoflank) {
      return [{}, {}];
    }
    return [{}, {}, {}, {}];
  };

  const createArrMetaparamsPracticeCustom = (typeTask, flagNoflank) => {
    if (typeTask === TypeTask.SHAPE_IDENT) {
      if (flagNoflank) {
        return [{ _sideTarg: TypeSide.RIGHT }, { _sideTarg: TypeSide.LEFT }];
      }
      return [
        { _sideTarg: TypeSide.RIGHT },
        { _sideTarg: TypeSide.LEFT },
        { _sideTarg: TypeSide.RIGHT },
        { _sideTarg: TypeSide.LEFT },
      ];
    }
    if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
      if (flagNoflank) {
        return [{ _same: TypeSame.SAME }, { _same: TypeSame.DIFF }];
      }
      return [
        { _same: TypeSame.SAME },
        { _same: TypeSame.DIFF },
        { _same: TypeSame.DIFF },
        { _same: TypeSame.SAME },
      ];
    }
    if (flagNoflank) {
      return [{}, {}];
    }

    return [{}, {}, {}, {}];
  };

  const createTimelinePart = (iPart, paramsPart, metaparamsPart) => {
    const iPartAux = iPart % 2;
    const timelinePart = [];
    const { typeTask } = metaparamsPart;

    // ===================================================
    // === NOFLANK
    // ===================================================
    if (paramsPart.numTrialNoflank > 0) {
      const metaparamsNoflank = {
        ...metaparamsPart,
        showFlankHor: false,
        showFlankVert: false,
        subtypeTrial: SubtypeTrial.CONST,
      };

      if (paramsPart.instrNoflank) {
        timelinePart.push(
          t_instructionGeneral(
            {
              modeGameSkipResponse: ModeGame.ALL,
            },
            `${typeTask}-noflank-intro`,
          ),
        );

        timelinePart.push(
          t_setParamsBlockCr({
            metaparams: metaparamsNoflank,
            info: {
              nameBlock: `block-instr-${paramsPart.tagParams}-noflank`,
              stageAssessment: AssessmentStage.INSTRUCTION,
              evaluateValidity: false,
              playAudio: true,
              animateMarkFix: true,
              animateStimTarg: true,
              animateBtnResp: true,
            },
          }),
        );

        // ===================================================
        // noflank | demo
        // ===================================================

        if (typeTask === TypeTask.SHAPE_IDENT) {
          const metaparamsDemo = createMetaparamsDemoCustom(
            typeTask,
            true,
            TypeSame.SAME,
            metaparamsPart.namesStim,
          );
          timelinePart.push(
            t_cr(
              {
                metaparams: {
                  ...metaparamsDemo,
                  durationResp: CR.DURATION_RESP_DEMO_MAX,
                },
                info: {
                  disableBtnsRespNonTarg: true,
                },
              },
              `${typeTask}-noflank-demo`,
            ),
          );
        } else if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
          const metaparamsDemoSame = createMetaparamsDemoCustom(
            typeTask,
            true,
            TypeSame.SAME,
            metaparamsPart.namesStim,
          );
          const metaparamsDemoDiff = createMetaparamsDemoCustom(
            typeTask,
            true,
            TypeSame.DIFF,
            metaparamsPart.namesStim,
          );
          timelinePart.push(
            t_cr(
              {
                metaparams: {
                  ...metaparamsDemoSame,
                  durationResp: CR.DURATION_RESP_DEMO_MAX,
                },
                info: {
                  disableBtnsRespNonTarg: true,
                },
              },
              `${typeTask}-noflank-demo-same`,
            ),
          );
          timelinePart.push(
            t_cr(
              {
                metaparams: {
                  ...metaparamsDemoDiff,
                  durationResp: CR.DURATION_RESP_DEMO_MAX,
                },
                info: {
                  disableBtnsRespNonTarg: true,
                },
              },
              `${typeTask}-noflank-demo-diff`,
            ),
          );
        }

        // ==================================
        // noflank | practice-av
        // ==================================

        timelinePart.push(
          t_instructionGeneral(
            {
              modeGameSkipResponse: ModeGame.ALL,
            },
            `let-us-try`,
          ),
        );

        timelinePart.push(
          t_setParamsBlockCr({
            metaparams: {
              ...metaparamsNoflank,
              durationFix: CR.DURATION_FIX_PRACTICE_AV,
              durationStim: CR.DURATION_STIM_PRACTICE_AV,
              durationResp: CR.DURATION_RESP_PRACTICE_AV_MAX,
            },
            info: {
              nameBlock: `block-practice-av-${paramsPart.tagParams}-noflank`,
              stageAssessment: AssessmentStage.PRACTICE,
              evaluateValidity: false,
              playAudio: true,
            },
          }),
        );

        const arrMetaparamsPracticeAv = createArrMetaparamsPracticeAvCustom(
          typeTask,
          true,
        );
        timelinePart.push(
          t_createBlockCr({
            playFeedbackAv: true,
            tagReqCr: `${typeTask}-noflank-practice-av`,
            arrMetaparams: arrMetaparamsPracticeAv,
            incrementIndBlock: false,
          }),
        );

        // ==================================
        // noflank | practice
        // ==================================

        timelinePart.push(
          t_instructionGeneral(
            {
              modeGameSkipResponse: ModeGame.ALL,
            },
            `faster-look-ahead-noflank-${iPartAux}`,
          ),
        );

        timelinePart.push(
          t_setParamsBlockCr({
            metaparams: {
              ...metaparamsNoflank,
              // durationFix: 5000,
              // durationStim: 5000,
            },
            info: {
              nameBlock: `block-practice-${paramsPart.tagParams}-noflank`,
              stageAssessment: AssessmentStage.PRACTICE,
              evaluateValidity: false,
            },
          }),
        );

        const arrMetaparamsPractice = createArrMetaparamsPracticeCustom(
          typeTask,
          true,
        );
        timelinePart.push(
          t_createBlockCr({
            arrMetaparams: arrMetaparamsPractice,
            incrementIndBlock: false,
          }),
        );

        // reset worker to avoid memory leak in Safari
        timelinePart.push({
          timeline: [t_et_etWorkerStopFull(), t_et_etWorkerPreload()],
          conditional_function: () =>
            sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
        });

        timelinePart.push(
          t_instructionGeneral(
            {
              modeGameSkipResponse: ModeGame.ALL,
            },
            `keep-going`,
          ),
        );
      }

      // ==================================
      // noflank | test
      // ==================================

      timelinePart.push(
        t_setParamsBlockCr({
          metaparams: metaparamsNoflank,
          info: {
            nameBlock: `block-test-${paramsPart.tagParams}-noflank`,
            stageAssessment: AssessmentStage.TEST,
          },
        }),
      );

      timelinePart.push(
        t_startNewBlockValidation(`block-test-${paramsPart.tagParams}-noflank`),
      );
      timelinePart.push(
        t_createBlockCr({
          balanceInd: typeTask === TypeTask.SHAPE_IDENT, // @THINK - important, depends on number of trials in a block
          typeTask: metaparamsPart.typeTask,
          numTrial: paramsPart.numTrialNoflank,
          numStim: metaparamsPart.namesStim.length,
        }),
      );
      timelinePart.push(t_markAsCompletedValidation());

      // reset worker to avoid memory leak in Safari
      timelinePart.push({
        timeline: [t_et_etWorkerStopFull(), t_et_etWorkerPreload()],
        conditional_function: () =>
          sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
      });

      timelinePart.push(
        t_instructionGeneral(
          {
            durationTrial: DURATIONS.BREAK_SHORT,
          },
          `between-noflank-main-${iPartAux}`,
        ),
      );
    }

    // ===================================================
    // === MAIN
    // ===================================================

    if (paramsPart.instr) {
      timelinePart.push(
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          `${typeTask}-intro`,
        ),
      );

      timelinePart.push(
        t_setParamsBlockCr({
          metaparams: metaparamsPart,
          info: {
            nameBlock: `block-instr-${paramsPart.tagParams}`,
            stageAssessment: AssessmentStage.INSTRUCTION,
            evaluateValidity: false,
            playAudio: true,
            animateMarkFix: true,
            animateStimTarg: true,
            animateBtnResp: true,
            subtypeTrial: SubtypeTrial.CONST,
          },
        }),
      );

      // ===================================================
      // main | demo
      // ===================================================

      if (typeTask === TypeTask.SHAPE_IDENT) {
        const metaparamsDemo = createMetaparamsDemoCustom(
          typeTask,
          false,
          TypeSame.SAME,
          metaparamsPart.namesStim,
        );
        timelinePart.push(
          t_cr(
            {
              metaparams: {
                ...metaparamsDemo,
                durationResp: CR.DURATION_RESP_DEMO_MAX,
              },
              info: {
                disableBtnsRespNonTarg: true,
              },
            },
            `${typeTask}-demo`,
          ),
        );
      } else if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
        const metaparamsDemoSame = createMetaparamsDemoCustom(
          typeTask,
          false,
          TypeSame.SAME,
          metaparamsPart.namesStim,
        );
        const metaparamsDemoDiff = createMetaparamsDemoCustom(
          typeTask,
          false,
          TypeSame.DIFF,
          metaparamsPart.namesStim,
        );
        timelinePart.push(
          t_cr(
            {
              metaparams: {
                ...metaparamsDemoSame,
                durationResp: CR.DURATION_RESP_DEMO_MAX,
              },
              info: {
                disableBtnsRespNonTarg: true,
              },
            },
            `${typeTask}-demo-same`,
          ),
        );
        timelinePart.push(
          t_cr(
            {
              metaparams: {
                ...metaparamsDemoDiff,
                durationResp: CR.DURATION_RESP_DEMO_MAX,
              },
              info: {
                disableBtnsRespNonTarg: true,
              },
            },
            `${typeTask}-demo-diff`,
          ),
        );
      }

      // ==================================
      // main | practice-av
      // ==================================

      timelinePart.push(
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          `let-us-practice`,
        ),
      );

      timelinePart.push(
        t_setParamsBlockCr({
          metaparams: {
            ...metaparamsPart,
            durationFix: CR.DURATION_FIX_PRACTICE_AV,
            durationStim: CR.DURATION_STIM_PRACTICE_AV,
            durationResp: CR.DURATION_RESP_PRACTICE_AV_MAX,
            subtypeTrial: SubtypeTrial.CONST,
          },
          info: {
            nameBlock: `block-practice-av-${paramsPart.tagParams}`,
            stageAssessment: AssessmentStage.PRACTICE,
            evaluateValidity: false,
            playAudio: true,
          },
        }),
      );

      const arrMetaparamsPracticeAv = createArrMetaparamsPracticeAvCustom(
        typeTask,
        false,
      );
      timelinePart.push(
        t_createBlockCr({
          playFeedbackAv: true,
          tagReqCr: `${typeTask}-practice-av`,
          arrMetaparams: arrMetaparamsPracticeAv,
          incrementIndBlock: false,
        }),
      );

      // ==================================
      // main | practice
      // ==================================

      timelinePart.push(
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          `faster-look-ahead-${iPartAux}`,
        ),
      );

      timelinePart.push(
        t_setParamsBlockCr({
          metaparams: {
            ...metaparamsPart,
            durationFix: CR.DURATION_FIX_PRACTICE,
            durationStim: CR.DURATION_STIM_PRACTICE,
            durationResp: CR.DURATION_RESP_PRACTICE_MAX,
            subtypeTrial: SubtypeTrial.CONST,
          },
          info: {
            nameBlock: `block-practice-${paramsPart.tagParams}`,
            stageAssessment: AssessmentStage.PRACTICE,
            evaluateValidity: false,
          },
        }),
      );

      const arrMetaparamsPractice = createArrMetaparamsPracticeCustom(
        typeTask,
        false,
      );
      timelinePart.push(
        t_createBlockCr({
          arrMetaparams: arrMetaparamsPractice,
          incrementIndBlock: false,
        }),
      );

      // reset worker to avoid memory leak in Safari
      timelinePart.push({
        timeline: [t_et_etWorkerStopFull(), t_et_etWorkerPreload()],
        conditional_function: () =>
          sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
      });

      timelinePart.push(
        t_instructionGeneral({}, `take-best-guess-${iPartAux}`),
      );
    }

    // ==================================
    // main | test
    // ==================================

    timelinePart.push(
      t_setParamsBlockCr({
        metaparams: metaparamsPart,
        info: {
          nameBlock: `block-test-${paramsPart.tagParams}`,
          stageAssessment: AssessmentStage.TEST,
        },
      }),
    );

    timelinePart.push(t_crCreateQuest());

    if (showSummary) {
      timelinePart.push(
        t_initSummary({
          title: `Bouma's coefficient: ${paramsPart.tagParams}`,
          labelY: "coefficient",
        }),
      );
    }

    timelinePart.push(
      t_startNewBlockValidation(`block-test-${paramsPart.tagParams}`),
    );

    timelinePart.push(
      t_createBlockCr({
        balanceInd: typeTask === TypeTask.SHAPE_IDENT, // @TODO: remove if test becomes 40 trials long
        typeTask: metaparamsPart.typeTask,
        numTrial: paramsPart.numTrial,
        numStim: metaparamsPart.namesStim.length,
      }),
    );

    timelinePart.push(t_markAsCompletedValidation());

    if (showSummary) {
      timelinePart.push(t_plotSummary());
    }

    return timelinePart;
  };

  const timeline = [];
  timeline.push(t_enterFullscreen(true));
  timeline.push(t_saveConfigAll());
  timeline.push(t_enterLandscape());
  timeline.push(t_installTouchGuards());
  timeline.push(t_setAllowModeInputAll(true));

  const runSetup =
    sessionGet(SK.SCREEN_CALIBRATE) || sessionGet(SK.VIDEO_ENABLE);
  timeline.push(t_collectDataMonitor(runSetup ? { keyImgBg: "" } : {}));

  if (includeTaskMain) {
    if (includeDebug) {
      timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: () => {
          const configEtDebug = sessionGet(SK.CONFIG_ET);
          return `<pre style="text-align:left; font-size:14px; max-height:70vh; overflow:auto; background:#f0f0f0; padding:16px;">${JSON.stringify(
            configEtDebug,
            null,
            2,
          )}</pre>`;
        },
        choices: ["OK"],
      });
    }

    // IMPORTANT: setupShort is intended to run with following flags
    // ?videoEnable=true&setupShort=true&etCalibrate=false&vdCalibrate=false&nameConfigEt=config-et-fm

    if (runSetup) {
      if (!setupShort) {
        timeline.push(
          t_instructionTech(
            {
              tagNameTask: NameTask.SHARED,
            },
            "setup-start",
          ),
        );

        const needRuler =
          sessionGet(SK.SCREEN_CALIBRATE) ||
          (sessionGet(SK.VIDEO_ENABLE) && sessionGet(SK.VD_CALIBRATE));

        if (needRuler) {
          timeline.push(
            t_instructionTech(
              {
                tagNameTask: NameTask.SHARED,
                keyImg: "sharedTechIconRulerAll",
              },
              "setup-ruler",
            ),
          );
        }

        // --- measure screen
        if (sessionGet(SK.SCREEN_CALIBRATE)) {
          timeline.push(t_screenMeasureWidth({}));
        }
      }

      // --- enable video
      if (sessionGet(SK.VIDEO_ENABLE)) {
        if (!setupShort) {
          timeline.push(
            t_instructionTech(
              {
                tagNameTask: NameTask.ET,
                modeGameSkipResponse: ModeGame.ALL,
              },
              "camera-intro",
            ),
          );
        }

        if (!setupShort) {
          timeline.push(t_et_cameraConfirm());
        } else {
          // camera might not be enabled correctly, but this is OK - we will filter it later
          sessionSet(SK.CAMERA_CONFIRMED, true);
        }

        timeline.push({
          timeline: [t_et_videoEnable()],
          conditional_function: () => sessionGet(SK.CAMERA_CONFIRMED),
        });

        if (!setupShort) {
          timeline.push({
            timeline: [
              t_instructionTech(
                {
                  keyImg: "sharedTechIconNoCameraAll",
                  tagNameTask: NameTask.ET,
                },
                "video-not-enabled-ok-to-continue",
              ),
            ],
            conditional_function: () =>
              sessionGet(SK.CAMERA_CONFIRMED) && !sessionGet(SK.VIDEO_ENABLED),
          });

          timeline.push({
            timeline: [
              t_et_videoConfirm(),
              {
                timeline: [
                  t_instructionTech(
                    {
                      keyImg: "sharedTechIconNoCameraAll",
                      tagNameTask: NameTask.ET,
                    },
                    "video-not-enabled-ok-to-continue",
                  ),
                ],
                conditional_function: () => !sessionGet(SK.VIDEO_ENABLED),
              },
            ],
            conditional_function: () =>
              sessionGet(SK.CAMERA_CONFIRMED) && sessionGet(SK.VIDEO_ENABLED),
          });
        }
      }

      // --- init facemesh and collect et- device data
      timeline.push({
        timeline: [t_et_fmInit()],
        conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
      });

      timeline.push({
        timeline: [t_et_etWorkerPreload()],
        conditional_function: () =>
          sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
      });

      timeline.push(t_et_collectDataDeviceScreenWebcam());

      // --- calibrate viewing distance
      if (!setupShort) {
        if (sessionGet(SK.VD_CALIBRATE)) {
          timeline.push({
            timeline: [
              t_instructionTech(
                {
                  tagNameTask: NameTask.ET,
                  modeGameSkipResponse: ModeGame.ALL,
                },
                "vd-calibr-intro",
              ),
            ],
            conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
          });

          timeline.push(
            t_et_vdCalibr({
              showLog: includeDebug,
            }),
          );
        }
      }

      if (includeDebug) {
        timeline.push({
          timeline: [t_et_htCalibrPlayground()],
          conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
        });
      }

      if (!setupShort) {
        timeline.push(
          t_instructionTech({ tagNameTask: NameTask.SHARED }, "setup-end"),
        );

        timeline.push(
          t_instructionTech(
            { tagNameTask: NameTask.SHARED },
            "setup-start-assessment",
          ),
        );
      }
    }

    // fallback for setting screen size - falling back to config
    timeline.push({
      type: jsPsychCallFunction,
      func: () => {
        const screenCalibrated = sessionGet(SK.SCREEN_CALIBRATED);
        if (!screenCalibrated) {
          sessionSet(SK.WIDTH_SCREEN_CM, SCREEN.WIDTH_CM_DEF);
        }
      },
    });

    // fallback for setting state + integrating screen into state
    timeline.push(t_et_stateFallbackDef());
    timeline.push(
      t_et_stateSave({
        idTrialSaveOrFn: "calibr-screen-vd-final",
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.NONE,
        requestUpload: false,
      }),
    );

    // =======================================================
    // === ET CALIBRATION (student)
    // =======================================================
    let runEtCalibr = false;
    let runEtCalibrCollect = false;

    // calculate whether we want to run ET calibrations
    timeline.push({
      type: jsPsychCallFunction,
      func: () => {
        runEtCalibr =
          sessionGet(SK.VIDEO_ENABLED) &&
          sessionGet(SK.ET_ENABLE) &&
          sessionGet(SK.ET_CALIBRATE);

        runEtCalibrCollect =
          sessionGet(SK.VIDEO_ENABLED) &&
          sessionGet(SK.ET_ENABLE) &&
          sessionGet(SK.ET_CALIBRATE_COLLECT);
      },
    });

    timeline.push(
      t_instructionGeneral(
        {
          animateBtn: true,
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE,
        },
        "intro",
      ),
    );

    const configEt = sessionGet(SK.CONFIG_ET);

    const { paramsCalibr } = configEt;

    timeline.push({
      timeline: [
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          "et-calibr-before-practice",
        ),

        t_et_etCalibr(
          {
            ...paramsCalibr,
            idCalibr: "et-calibr-practice",
            playAudio: true,
            videoBitsPerSecond: ET.VIDEO.VIDEO_BITS_PER_SECOND_LOW,
            showLog: includeDebug,
            // srcMarkFix: sessionGet(SK.MAP_STIM)?.find(s => s.name === 'rocket')?.src
          },
          "practice",
        ),
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          "et-calibr-before-calibr",
        ),
        t_et_etCalibr(
          {
            ...paramsCalibr,
            idCalibr: "et-calibr",
            videoBitsPerSecond: ET.VIDEO.VIDEO_BITS_PER_SECOND_LOW,
            playAudio: true,
            showLog: includeDebug,
            // srcMarkFix: sessionGet(SK.MAP_STIM)?.find(s => s.name === 'rocket')?.src
          },
          "calibr",
        ),
      ],
      conditional_function: () => runEtCalibr,
    });

    timeline.push(t_et_stateFallbackDef());
    timeline.push(
      t_et_stateSave({
        idTrialSaveOrFn: "calibr-all-final",
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.NONE,
        requestUpload: false,
      }),
    );

    if (includeDebug) {
      timeline.push(t_et_etTest());
    }

    // =======================================================
    // === ET CALIBRATION COLLECT (student)
    // =======================================================

    const { arrParamsCalibrCollect } = configEt;
    let arrParamsCalibrCollectEnabled = [];
    let numEtCalibrCollectEnabled = 0;
    if (arrParamsCalibrCollect) {
      arrParamsCalibrCollectEnabled = configEt.arrParamsCalibrCollect.filter(
        (params) => params.enabled,
      );
      numEtCalibrCollectEnabled = arrParamsCalibrCollectEnabled.length;
    }

    const timelineEtCalibrCollect = [];
    if (numEtCalibrCollectEnabled > 0) {
      timelineEtCalibrCollect.push(
        t_instructionGeneral(
          { modeGameSkipResponse: ModeGame.ALL },
          "et-calibr-collect-jump",
        ),
      );
      for (let iCalibr = 0; iCalibr < numEtCalibrCollectEnabled; iCalibr += 1) {
        const isLast = iCalibr === numEtCalibrCollectEnabled - 1;
        const isCurSmooth = arrParamsCalibrCollectEnabled[iCalibr].moveSmooth;
        const isNextSmooth = isLast
          ? false
          : arrParamsCalibrCollectEnabled[iCalibr + 1].moveSmooth;
        const isBeforeSmoothFirst = !isCurSmooth && isNextSmooth;

        timelineEtCalibrCollect.push(
          t_et_etCalibr({
            ...arrParamsCalibrCollectEnabled[iCalibr],
            playAudio: false,
            playAudioGap: false,
            showLog: includeDebug,
            isCalibrCollect: true,
            keepDecorOnFinish: !(isLast || isBeforeSmoothFirst),
          }),
        );
        if (isBeforeSmoothFirst) {
          timelineEtCalibrCollect.push(
            t_instructionGeneral(
              { modeGameSkipResponse: ModeGame.ALL },
              "et-calibr-collect-smooth",
            ),
          );
        }
      }
    }

    timeline.push({
      timeline: timelineEtCalibrCollect,
      conditional_function: () => runEtCalibrCollect,
    });

    timeline.push({
      timeline: [
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
          },
          "et-calibr-after-calibr",
        ),
      ],
      conditional_function: () =>
        runEtCalibr || (runEtCalibrCollect && numEtCalibrCollectEnabled > 0),
    });

    // ========================================================
    // ===  ASSESSMENT (student)
    // ========================================================

    timeline.push(
      t_createValidityEvaluator({
        responseTimeLowThreshold: VALIDATION.RESPONSE_TIME_LOW_THRESHOLD,
        accuracyThreshold: VALIDATION.ACCURACY_THRESHOLD,
      }),
    );

    const configBlock = sessionGet(SK.CONFIG_BLOCK);

    const arrParamsPart = configBlock.subvars[config.subvar];

    const numPart = arrParamsPart.length;
    for (let iPart = 0; iPart < numPart; iPart += 1) {
      const paramsPart = arrParamsPart[iPart];

      const metaparamsPart =
        configBlock.mapMetaparamsBlock[paramsPart.tagParams];

      const timelinePart = createTimelinePart(
        iPart,
        paramsPart,
        metaparamsPart,
      );
      timeline.push({ timeline: timelinePart });

      if (iPart < numPart - 1) {
        timeline.push(
          t_instructionGeneral(
            {
              durationTrial: DURATIONS.BREAK,
            },
            `break-${iPart}`,
          ),
        );
      }
    }

    timeline.push(
      t_instructionGeneral(
        {
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE,
        },
        `end-screen`,
      ),
    );
  }

  // =======================================================
  // *******************************************************
  //  PLAYGROUND ET
  // *******************************************************
  // =======================================================

  if (includePlaygroundEt) {
    timeline.push(
      t_instructionTech({
        text1: "<h2>EYE-TRACKING PLAYGROUND</h2><hr>",
      }),
    );

    timeline.push({
      timeline: [t_et_videoEnable(), t_et_videoConfirm()],
      conditional_function: () => !sessionGet(SK.VIDEO_ENABLED),
    });

    timeline.push(t_enterFullscreen(true));
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ["OK"],
      stimulus: () =>
        `<h2>Head and Distance Tracking Playground</h2><br><br><br>`,
    });

    timeline.push({
      timeline: [t_et_fmInit()],
      conditional_function: () => state.faceMesh === null,
    });

    timeline.push(t_et_htCalibrPlayground());

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ["OK"],
      stimulus: () =>
        `<h2>Eye Tracking Calibration Playground</h2><br><br><br>`,
    });

    timeline.push(
      t_et_etCalibr({
        srcMarkFix: sessionGet(SK.MAP_STIM)?.find((s) => s.name === "rocket")
          ?.src,
      }),
    );

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ["OK"],
      stimulus: () => `<h2>Eye Tracking Testing Playground</h2><br><br><br>`,
    });

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ["OK"],
      stimulus: () => `<h2>Eye Model Playground</h2><br><br><br>`,
    });

    timeline.push(t_et_imEye());
  }

  if (includePlaygroundCr) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ["OK"],
      stimulus: () => `<h2>Crowding Playground</h2><br><br><br>`,
    });

    timeline.push(
      t_initSummary({ title: "Bouma's coefficient", labelY: "coefficient" }),
    );
    timeline.push(t_crParams());

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: "<h1>Slow trials</h1>",
      choices: ["OK"],
    });

    for (let i = 0; i < numTrialBlockSlow; i += 1) {
      timeline.push(
        t_cr({
          metaparams: {
            durationFix: durationFixSlow,
            durationStim: durationStimSlow,
          },
          info: {
            stageAssessment: AssessmentStage.PRACTICE,
          },
        }),
      );
    }

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: "<h1>Fast trials</h1>",
      choices: ["OK"],
    });

    timeline.push(t_crCreateQuest());

    let iTrial = 0;
    timeline.push({
      timeline: [
        t_cr({
          metaparams: {},
          info: {
            stageAssessment: AssessmentStage.TEST,
          },
        }),
      ],
      loop_function: () => {
        iTrial += 1;
        return iTrial < sessionGet(SK.NUM_TRIAL);
      },
    });

    timeline.push(t_plotSummary());
  }

  // =================================================================
  // EVAL TASK
  // =================================================================

  if (includeTaskEval) {
    timeline.push(t_instructionTech({}, "@eval-welcome"));

    timeline.push(
      t_instructionTech(
        {
          keyImg: "sharedTechIconRulerAll",
        },
        "@eval-setup-ruler",
      ),
    );

    timeline.push(t_screenMeasureWidth({}));

    timeline.push(t_instructionTech({}, "@eval-test-structure"));

    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskFixationAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-keep-fixation",
      ),
    );

    // =====================================================
    // SHAPE_IDENT - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskShapeIdentSameFlankAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-shape-ident",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeIdent = {
      typeTask: TypeTask.SHAPE_IDENT,
      namesStim: ["butterfly", "car", "duck", "heart", "rocket"],
      _sameFlank: true,
      _nameFlank: "cloud",
    };

    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          ...metaparamsShapeIdent,
          durationFix: durationFixSlow,
          durationStim: durationStimSlow,
        },
        info: {
          stageAssessment: AssessmentStage.PRACTICE,
          nameBlock: "shape-ident-practice",
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, "@eval-fast-trials"));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeIdent,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: "shape-ident-test",
        },
      }),
    );

    timeline.push(t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        t_initSummary({
          title: "Bouma's coefficient",
          labelY: "coefficient",
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(t_plotSummary());
    }

    // =====================================================
    // SHAPE_COMPARE_REF - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskShapeCompareRefSameFlankAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-shape-compare-ref",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeCompareRef = {
      typeTask: TypeTask.SHAPE_COMPARE_REF,
      namesStim: ["butterfly", "car", "duck", "heart", "rocket"],
      _sameFlank: true,
      _nameFlank: "cloud",
    };

    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          ...metaparamsShapeCompareRef,
          durationFix: durationFixSlow,
          durationStim: durationStimSlow,
        },
        info: {
          stageAssessment: AssessmentStage.PRACTICE,
          nameBlock: "shape-compare-ref-practice",
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, "@eval-fast-trials"));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeCompareRef,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: "shape-compare-ref-test",
        },
      }),
    );

    timeline.push(t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        t_initSummary({
          title: "Bouma's coefficient",
          labelY: "coefficient",
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(t_plotSummary());
    }

    // =====================================================
    // SHAPE_COMPARE_LR - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskShapeCompareLrSameFlankAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-shape-compare-lr",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeCompareLr = {
      typeTask: TypeTask.SHAPE_COMPARE_LR,
      namesStim: ["butterfly", "car", "duck", "heart", "rocket"],
      _nameFlank: "cloud",
      _sameFlank: true,
    };

    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          ...metaparamsShapeCompareLr,
          durationFix: durationFixSlow,
          durationStim: durationStimSlow,
        },
        info: {
          stageAssessment: AssessmentStage.PRACTICE,
          nameBlock: "shape-compare-lr-practice",
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, "@eval-fast-trials"));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeCompareLr,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: "shape-compare-lr-test",
        },
      }),
    );

    timeline.push(t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        t_initSummary({
          title: "Bouma's coefficient",
          labelY: "coefficient",
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(t_plotSummary());
    }

    // =====================================================
    // ORIENT_IDENT
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskOrientIdentAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-orient-ident",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsOrientIdent = {
      typeTask: TypeTask.ORIENT_IDENT,
      namesStim: ["rocket", "cloud"],
    };

    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          ...metaparamsOrientIdent,
          durationFix: durationFixSlow,
          durationStim: durationStimSlow,
        },
        info: {
          stageAssessment: AssessmentStage.PRACTICE,
          nameBlock: "orient-ident-practice",
        },
      }),
    );

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, "@eval-fast-trials"));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsOrientIdent,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: "orient-ident-test",
        },
      }),
    );

    timeline.push(t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        t_initSummary({
          title: "Bouma's coefficient",
          labelY: "coefficient",
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(t_plotSummary());
    }

    // =====================================================
    // SURVEY
    // =====================================================

    timeline.push(t_instructionTech({}, "@eval-take-survey"));

    const paramsSurvey = {
      titlesCol: ["Very easy", "Easy", "Medium", "Hard", "Very hard"],
      namesRow: [
        "shape-ident",
        "shape-compare-ref",
        "shape-compare-lr",
        "orient-ident",
      ],
      keysImgRow: [
        "taskShapeIdentSameFlankAll",
        "taskShapeCompareRefSameFlankAll",
        "taskShapeCompareLrSameFlankAll",
        "taskOrientIdentAll",
      ], // []
    };

    const paramsSurveyDifficult = {
      ...paramsSurvey,
      title: "How easy was each task?",
      subtitle: "Consider your level of frustration",
      nameSurvey: "survey-difficult",
    };

    const paramsSurveyAwkward = {
      ...paramsSurvey,
      title:
        "How easy was it to map your answer to the response buttons or keys?",
      subtitle: "Consider the cognitive or motor effort required",
      nameSurvey: "survey-awkward",
    };

    timeline.push(t_surveyRatingRadio(paramsSurveyDifficult));

    timeline.push(t_surveyRatingRadio(paramsSurveyAwkward));

    const paramsSurveyText = {
      title: "Please share any additional comments",
      nameSurvey: "survey-comments",
    };

    timeline.push(t_surveyText(paramsSurveyText));

    timeline.push(t_instructionTech({}, "@eval-end-screen"));
  }

  timeline.push({
    timeline: [t_et_etWorkerStopFull(), t_et_fmClose(), t_et_videoStop()],
    conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
  });

  timeline.push(t_exitFullscreen());

  return { timeline };
};
