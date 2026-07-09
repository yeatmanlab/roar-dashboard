// TODO: temporary - begin
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
// TODO: temporary - end
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { mapTrials } from '../../shared/trials/mapTrials';
import { cr_mapTrials } from './cr_mapTrials';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { CR_SESSION_KEYS as SK } from '../helpers/cr_sessionKeys';
import { CR } from '../helpers/cr_constants';
import { AssessmentStage, NameTask, TypeSize, ModeGame } from '../../shared/helpers/namingHelpers';
import { t_instructionTech } from '../../shared/trials/instructionTech';
import { t_cr, TypeSame, TypeSide, TypeTask } from './cr_trial';
import { t_createBlockCr, t_setParamsBlockCr } from './cr_block';
import { t_surveyRatingRadio, t_surveyText } from '../../shared/trials/surveyHelpers';
import { et_mapTrials } from '../../et/et_mapTrials';
import { t_et_videoConfirm, t_et_videoEnable } from '../../et/et_videoHelpers';
import { t_et_fmInit } from '../../et/et_fmHelpers';
import { t_et_collectDataDeviceScreenWebcam } from '../../et/et_deviceHelpers';
import { t_et_vdCalibr, t_et_htCalibrPlayground } from '../../et/et_htHelpers';
import { DURATIONS, SCREEN } from '../../shared/helpers/constants';
import { et_TypeSaveSnapshots, state, t_et_stateFallbackDef, t_et_stateSave } from '../../et/et_state';
import { t_screenMeasureWidth } from '../../shared/trials/screenCalibrateHelpers';
import { t_et_etTest, t_et_etCalibr, t_et_etWorkerPreload, t_et_etWorkerStopFull } from '../../et/et_etHelpers';
import { t_et_imEye } from '../../et/et_imHelpers';
import { t_enterFullscreen, t_enterLandscape, t_installTouchGuards } from '../../shared/trials/screenHelpers';
import { t_setAllowModeInputAll } from '../../shared/trials/inputModeHelpers';
import { t_instructionGeneral } from '../../shared/trials/instructionGeneral';
import { t_collectDataMonitor } from '../../shared/trials/collectDataMonitor';
import { t_crCreateQuest } from '../helpers/cr_questHelpers';
import { t_initSummary, t_plotSummary } from '../../shared/trials/summaryHelpers';
import { t_saveConfigAll } from '../helpers/cr_crHelpers';

// TODO: see whether I need those maps at all or is it an over-engineering?
const tr = { ...mapTrials, ...cr_mapTrials, ...et_mapTrials };

// TODO: clean for the final version
const includePlaygroundEt = false;
const includePlaygroundCr = false;
const includeEvalTask = false;
const includeProto = true;
const showSummary = true; // TODO: temp

const numTrialBlock = 12; // 12
const numTrialBlockSlow = 3; // 3
const durationFixSlow = 1500;
const durationStimSlow = 2000; // 2000

// TODO: very important
// have a setting showing BLUE STRIPES on the sides for eye-tracking

export const t_timelineDef = () => {
  // TODO: this is super important for eye-tracking to work - see where to put it
  const config = sessionGet(SK.CONFIG);
  const { videoEnable, videoRecord, screenCalibrate, vdCalibrate, etCalibrate, etEnable } = config;
  sessionSet(SK.VIDEO_ENABLE, videoEnable);
  sessionSet(SK.VIDEO_RECORD, videoRecord);
  sessionSet(SK.SCREEN_CALIBRATE, screenCalibrate);
  sessionSet(SK.VD_CALIBRATE, vdCalibrate);
  sessionSet(SK.ET_CALIBRATE, etCalibrate);
  sessionSet(SK.ET_ENABLE, etEnable);

  const createMetaparamsDemoCustom = (typeTask, flagNoflank, typeSame, namesStim) => {
    if (typeTask === TypeTask.SHAPE_IDENT) {
      if (flagNoflank) {
        return {
          indTarg: namesStim.indexOf('butterfly'),
          _sideTarg: TypeSide.RIGHT,
        };
      }
      return {
        indTarg: namesStim.indexOf('car'),
        _sideTarg: TypeSide.LEFT,
      };
    }
    if (typeTask === TypeTask.SHAPE_COMPARE_LR) {
      if (flagNoflank) {
        if (typeSame === TypeSame.DIFF) {
          return {
            indTargL: namesStim.indexOf('duck'),
            indTargR: namesStim.indexOf('tree'),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.DIFF,
          };
        }
        if (typeSame === TypeSame.SAME) {
          return {
            indTargL: namesStim.indexOf('butterfly'),
            indTargR: namesStim.indexOf('butterfly'),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.SAME,
          };
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (typeSame === TypeSame.DIFF) {
          return {
            indTargL: namesStim.indexOf('heart'),
            indTargR: namesStim.indexOf('car'),
            _sideTarg: TypeSide.BOTH,
            _same: TypeSame.DIFF,
          };
        }
        if (typeSame === TypeSame.SAME) {
          return {
            indTargL: namesStim.indexOf('tree'),
            indTargR: namesStim.indexOf('tree'),
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
      return [{ _same: TypeSame.SAME }, { _same: TypeSame.DIFF }, { _same: TypeSame.DIFF }, { _same: TypeSame.SAME }];
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
      return [{ _same: TypeSame.SAME }, { _same: TypeSame.DIFF }, { _same: TypeSame.DIFF }, { _same: TypeSame.SAME }];
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
          const metaparamsDemo = createMetaparamsDemoCustom(typeTask, true, TypeSame.SAME, metaparamsPart.namesStim);
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
              durationFix: CR.DURATION_MARK_FIX_PRACTICE_AV,
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

        const arrMetaparamsPracticeAv = createArrMetaparamsPracticeAvCustom(typeTask, true);
        timelinePart.push(
          t_createBlockCr({
            playFeedbackAv: true,
            tagReqCr: `${typeTask}-noflank-practice-av`,
            arrMetaparams: arrMetaparamsPracticeAv,
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
            metaparams: { ...metaparamsNoflank },
            info: {
              nameBlock: `block-practice-${paramsPart.tagParams}-noflank`,
              stageAssessment: AssessmentStage.PRACTICE,
              evaluateValidity: false,
            },
          }),
        );

        const arrMetaparamsPractice = createArrMetaparamsPracticeCustom(typeTask, true);
        timelinePart.push(
          t_createBlockCr({
            arrMetaparams: arrMetaparamsPractice,
          }),
        );

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
        t_createBlockCr({
          balanceInd: typeTask === TypeTask.SHAPE_IDENT, // TODO: temp, should be TRUE with 20 no-flank trials (or keep as is)
          typeTask: metaparamsPart.typeTask,
          numTrial: paramsPart.numTrialNoflank,
          numStim: metaparamsPart.namesStim.length,
        }),
      );

      timelinePart.push(t_instructionGeneral({}, `between-noflank-main-${iPartAux}`));
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
          },
        }),
      );

      // ===================================================
      // main | demo
      // ===================================================

      if (typeTask === TypeTask.SHAPE_IDENT) {
        const metaparamsDemo = createMetaparamsDemoCustom(typeTask, false, TypeSame.SAME, metaparamsPart.namesStim);
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
        const metaparamsDemoSame = createMetaparamsDemoCustom(typeTask, false, TypeSame.SAME, metaparamsPart.namesStim);
        const metaparamsDemoDiff = createMetaparamsDemoCustom(typeTask, false, TypeSame.DIFF, metaparamsPart.namesStim);
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
            durationFix: CR.DURATION_MARK_FIX_PRACTICE_AV,
            durationStim: CR.DURATION_STIM_PRACTICE_AV,
            durationResp: CR.DURATION_RESP_PRACTICE_AV_MAX,
          },
          info: {
            nameBlock: `block-practice-av-${paramsPart.tagParams}`,
            stageAssessment: AssessmentStage.PRACTICE,
            evaluateValidity: false,
            playAudio: true,
          },
        }),
      );

      const arrMetaparamsPracticeAv = createArrMetaparamsPracticeAvCustom(typeTask, false);
      timelinePart.push(
        t_createBlockCr({
          playFeedbackAv: true,
          tagReqCr: `${typeTask}-practice-av`,
          arrMetaparams: arrMetaparamsPracticeAv,
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
            durationFix: CR.DURATION_MARK_FIX_PRACTICE,
            durationStim: CR.DURATION_STIM_PRACTICE,
            durationResp: CR.DURATION_RESP_PRACTICE_MAX,
          },
          info: {
            nameBlock: `block-practice-${paramsPart.tagParams}`,
            stageAssessment: AssessmentStage.PRACTICE,
            evaluateValidity: false,
          },
        }),
      );

      const arrMetaparamsPractice = createArrMetaparamsPracticeCustom(typeTask, false);
      timelinePart.push(
        t_createBlockCr({
          arrMetaparams: arrMetaparamsPractice,
        }),
      );

      timelinePart.push(
        t_instructionGeneral(
          {
            // modeGameSkipResponse: ModeGame.ALL,  // TODO: decide whether we want NEXT button or not ---
            // change text in translation.json if the button removed!!!
          },
          `take-best-guess-${iPartAux}`,
        ),
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
          labelY: 'coefficient',
        }),
      );
    }

    timelinePart.push(
      t_createBlockCr({
        balanceInd: typeTask === TypeTask.SHAPE_IDENT, // TODO: REMOVE!!! Test should be 40 long
        typeTask: metaparamsPart.typeTask,
        numTrial: paramsPart.numTrial,
        numStim: metaparamsPart.namesStim.length,
      }),
    );

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

  const runSetup = sessionGet(SK.SCREEN_CALIBRATE) || sessionGet(SK.VIDEO_ENABLE);
  // const runSetup = false; // TODO: temp, should be as in the line above
  timeline.push(t_collectDataMonitor(runSetup ? { keyImgBg: '' } : {}));

  if (includeProto) {
    if (runSetup) {
      timeline.push(
        t_instructionTech(
          {
            tagNameTask: NameTask.SHARED,
          },
          'setup-start',
        ),
      );

      const needRuler = sessionGet(SK.SCREEN_CALIBRATE) || (sessionGet(SK.VIDEO_ENABLE) && sessionGet(SK.VD_CALIBRATE));

      if (needRuler) {
        timeline.push(
          t_instructionTech(
            {
              tagNameTask: NameTask.SHARED,
              keyImg: 'sharedTechIconRulerAll',
            },
            'setup-ruler',
          ),
        );
      }

      // --- measure screen
      if (sessionGet(SK.SCREEN_CALIBRATE)) {
        timeline.push(t_screenMeasureWidth({}));
      }

      // --- enable video
      if (sessionGet(SK.VIDEO_ENABLE)) {
        timeline.push(t_et_videoEnable());

        timeline.push({
          timeline: [
            t_instructionTech(
              {
                tagNameTask: NameTask.ET,
              },
              'video-not-enabled-ok-to-continue',
            ),
          ],
          conditional_function: () => !sessionGet(SK.VIDEO_ENABLED),
        });

        timeline.push(t_et_videoConfirm());
      }

      // --- init facemesh and collect et- device data
      timeline.push({
        timeline: [t_et_fmInit()],
        conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
      });

      // @new - begin
      timeline.push({
        timeline: [t_et_etWorkerPreload()],
        conditional_function: () => sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
      });
      // @new - end

      timeline.push(t_et_collectDataDeviceScreenWebcam());

      // --- calibrate viewing distance
      if (sessionGet(SK.VD_CALIBRATE)) {
        timeline.push({
          timeline: [
            t_instructionTech(
              {
                tagNameTask: NameTask.ET,
                modeGameSkipResponse: ModeGame.ALL,
              },
              'vd-calibr-intro',
            ),
          ],
          conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
        });

        timeline.push(t_et_vdCalibr());
      }
      // timeline.push(t_htCalibr());
      timeline.push(t_et_htCalibrPlayground());

      // TODO: - make skip response
      timeline.push(t_instructionTech({ tagNameTask: NameTask.SHARED }, 'setup-end'));
      timeline.push(t_instructionTech({ tagNameTask: NameTask.SHARED }, 'setup-start-assessment'));
    }

    // fallback for setting screen size - CONFIG
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
    // TODO: run again after et
    timeline.push(t_et_stateFallbackDef());
    timeline.push(
      t_et_stateSave({
        idTrialSaveOrFn: 'calibr-screen-vd-final',
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.NONE,
        requestUpload: false,
      }),
    );

    // =======================================================
    // === ET CALIBRATION
    // =======================================================
    let runEtCalibr = false;

    // calculate whether we want to run ET calibration (part of student assessment)
    timeline.push({
      type: jsPsychCallFunction,
      func: () => {
        runEtCalibr = sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE) && sessionGet(SK.ET_CALIBRATE);
      },
    });

    timeline.push(
      t_instructionGeneral(
        {
          animateBtn: true,
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE,
        },
        'intro',
      ),
    );

    const locsFixCalibr = [
      { x: 25, y: 20 },
      { x: 75, y: 20 },
      { x: 25, y: 60 },
      { x: 75, y: 60 },
    ];

    timeline.push({
      timeline: [
        t_instructionGeneral(
          {
            durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
          },
          'et-calibr-before-practice',
        ),

        t_et_etCalibr(
          {
            playAudio: true,
            locsFix: locsFixCalibr,
            // srcMarkFix: sessionGet(SK.MAP_STIM)?.find(s => s.name === 'rocket')?.src
          },
          'practice',
        ),
        t_instructionGeneral(
          {
            durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
            animateBtn: true, // TODO: decide whether we want a button at all OR skip
          },
          'et-calibr-before-calibr',
        ),
        t_et_etCalibr(
          {
            playAudio: true,
            locsFix: locsFixCalibr,
            // srcMarkFix: sessionGet(SK.MAP_STIM)?.find(s => s.name === 'rocket')?.src
          },
          'calibr',
        ),
        t_instructionGeneral(
          {
            modeGameSkipResponse: ModeGame.ALL,
            durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
          },
          'et-calibr-after-calibr',
        ),
      ],
      conditional_function: () => runEtCalibr,
    });

    timeline.push(t_et_stateFallbackDef());
    timeline.push(
      t_et_stateSave({
        idTrialSaveOrFn: 'calibr-all-final',
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.NONE,
        requestUpload: false,
      }),
    );
    timeline.push(t_et_etTest());

    // ========================================================
    // ===  ASSESSMENT
    // ========================================================

    // {
    //   "tagPart": "shape-ident",
    //   "nameBlock": "block-shape-ident|hv|sync|",
    //   "numTrial": 40,
    //   "demo": true,
    //   "quest": true,
    //   "numTrialNoflank": 20,
    //   "demoNoflank": true,
    //   "questNoflank": false
    // }

    const configBlock = sessionGet(SK.CONFIG_BLOCK);

    const arrParamsPart = configBlock.subvars[config.subvar];

    const numPart = arrParamsPart.length;
    for (let iPart = 0; iPart < numPart; iPart += 1) {
      const paramsPart = arrParamsPart[iPart];
      // TODO: temp
      // alert(JSON.stringify(paramsPart, null,2));
      const metaparamsPart = configBlock.mapMetaparamsBlock[paramsPart.tagParams];
      // TODO: temp
      // alert(JSON.stringify(metaparamsPart, null, 2));
      const timelinePart = createTimelinePart(iPart, paramsPart, metaparamsPart);
      timeline.push({ timeline: timelinePart });

      if (iPart < numPart - 1) {
        timeline.push(
          t_instructionGeneral(
            {
              durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
            },
            `break-${iPart}`,
          ),
        );
      }
    }

    timeline.push(
      t_instructionGeneral(
        {
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
        },
        `end-screen`,
      ),
    );

    // TODO - should the worked be preloaded & stopped again, if we decide to continue with different parts????
    // @new - begin
    timeline.push({
      timeline: [t_et_etWorkerStopFull()],
      conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
    });
    // @new - end

    // {
    //       "numTrial": 10,
    //       "nameBlock": "block-shape-ident--fnone",
    //       "quest": false,
    //       "metaparams": {
    //         "typeTask": "shape-ident",
    //         "namesStim": ["duck", "heart", "butterfly", "tree", "car"],
    //         "showFlankHor": false,
    //         "showFlankVert": false,
    //         "_eccentTarg": 6,
    //         "_unitEccentTarg": "deg",
    //         "durationTargPre": 0,
    //         "durationStim": 167
    //       }
    //     },

    // --------------------------------------------------------
    // --- task - shape ident
    // --------------------------------------------------------

    // @@@BBB

    // TODO: namesStim, delays, everything should come from roav-cr-config-block-def.json
    // TODO: should be flag whether to run it + all params in config
    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          typeTask: TypeTask.SHAPE_IDENT,
          // TODO: keep in this exact order in config!
          namesStim: ['duck', 'heart', 'butterfly', 'tree', 'car'], // "rocket" instead of "tree" ???
          _sameFlank: true,
          _nameFlank: 'cloud',
          durationFix: CR.DURATION_MARK_FIX_PRACTICE_AV,
          durationStim: CR.DURATION_STIM_PRACTICE_AV,
        },
        info: {
          nameBlock: 'block-instr-shape-ident',
          stageAssessment: AssessmentStage.INSTRUCTION,
          evaluateValidity: false,
          playAudio: true,
          animateMarkFix: true,
          animateStimTarg: true,
          animateBtnResp: true,
        },
      }),
    );

    timeline.push(
      t_cr(
        {
          metaparams: {
            indTarg: 2,
          },
          info: {
            disableBtnsRespNonTarg: true,
          },
        },
        'try-instr-demo-shape-ident',
      ),
    );

    // --------------------------------------------------------
    // --- task - shape ident SOA
    // --------------------------------------------------------

    // TODO: probably do not need a separate intro
    timeline.push(
      t_instructionGeneral(
        {
          text1: 'TASK: shape ident SOA',
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
        },
        'intro-shape-ident-soa',
      ),
    );

    // TODO: namesStim, delays, everything should come from roav-cr-config-block-def.json
    // TODO: should be flag whether to run it + all params in config
    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          typeTask: TypeTask.SHAPE_IDENT,
          // TODO: keep in this exact order in config!
          namesStim: ['duck', 'heart', 'butterfly', 'tree', 'car'], // "rocket" instead of "tree" ???
          _sameFlank: true,
          _nameFlank: 'cloud',
          durationFix: CR.DURATION_MARK_FIX_PRACTICE_AV,
          durationStim: CR.DURATION_STIM_PRACTICE_AV,
          durationTargPre: -3000,
        },
        info: {
          nameBlock: 'block-instr-shape-ident-soa',
          stageAssessment: AssessmentStage.INSTRUCTION,
          evaluateValidity: false,
          playAudio: true,
          animateMarkFix: true,
          animateStimTarg: true,
          animateBtnResp: true,
        },
      }),
    );

    timeline.push(
      t_cr(
        {
          info: {
            disableBtnsRespNonTarg: true,
          },
        },
        'try-instr-demo-shape-ident-soa',
      ),
    );

    // --------------------------------------------------------
    // --- task - shape compare lr
    // --------------------------------------------------------

    timeline.push(
      t_instructionGeneral(
        {
          text1: 'TASK: shape compare LR',
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
        },
        'intro-shape-compare-lr',
      ),
    );

    // TODO: namesStim, delays, everything should come from roav-cr-config-block-def.json
    // TODO: should be flag whether to run it + all params in config
    timeline.push(
      t_setParamsBlockCr({
        metaparams: {
          typeTask: TypeTask.SHAPE_COMPARE_LR,
          namesStim: ['duck', 'heart', 'butterfly', 'tree', 'car'], // "rocket" instead of "tree" ???
          _sameFlank: true,
          _nameFlank: 'cloud',
          durationFix: CR.DURATION_MARK_FIX_PRACTICE_AV,
          durationStim: CR.DURATION_STIM_PRACTICE_AV,
          // durationTargPre: -3000,
        },
        info: {
          nameBlock: 'block-instr-shape-compare-lr',
          stageAssessment: AssessmentStage.INSTRUCTION,
          evaluateValidity: false,
          playAudio: true,
          animateMarkFix: true,
          animateStimTarg: true,
          animateBtnResp: true,
        },
      }),
    );

    timeline.push(
      t_cr(
        {
          metaparams: {
            indTargL: 1,
            indTargR: 1,
            _same: TypeSame.SAME,
          },
          info: {
            disableBtnsRespNonTarg: true,
          },
        },
        'try-instr-demo-shape-compare-lr-same',
      ),
    );

    timeline.push(
      t_cr(
        {
          metaparams: {
            indTargL: 0,
            indTargR: 4,
            _same: TypeSame.DIFF,
          },
          info: {
            disableBtnsRespNonTarg: true,
          },
        },
        'try-instr-demo-shape-compare-lr-diff',
      ),
    );

    // --------------------------------------------------------
    // --- task - shape compare lr SOA
    // --------------------------------------------------------

    timeline.push(
      t_instructionGeneral(
        {
          text1: 'TASK: shape compare LR',
          durationTrial: DURATIONS.WAIT_FOR_RESPONSE, // TODO: temporary!!!
        },
        'intro-shape-compare-lr-soa',
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
        text1: '<h2>EYE-TRACKING PLAYGROUND</h2><hr>',
      }),
    );

    timeline.push({
      timeline: [t_et_videoEnable(), t_et_videoConfirm()],
      conditional_function: () => !sessionGet(SK.VIDEO_ENABLED),
    });

    timeline.push(tr.t_enterFullscreen(true));
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ['OK'],
      stimulus: () => `<h2>Head and Distance Tracking Playground</h2><br><br><br>`,
    });

    timeline.push({
      timeline: [t_et_fmInit()],
      conditional_function: () => state.faceMesh === null,
    });

    timeline.push(t_et_htCalibrPlayground());

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ['OK'],
      stimulus: () => `<h2>Eye Tracking Calibration Playground</h2><br><br><br>`,
    });

    // timeline.push(t_et_etCalibrPlayground());
    timeline.push(
      t_et_etCalibr({
        srcMarkFix: sessionGet(SK.MAP_STIM)?.find((s) => s.name === 'rocket')?.src,
      }),
    );

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ['OK'],
      stimulus: () => `<h2>Eye Tracking Testing Playground</h2><br><br><br>`,
    });

    // TODO: put it back
    // timeline.push(t_et_etTest());

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ['OK'],
      stimulus: () => `<h2>Eye Model Playground</h2><br><br><br>`,
    });

    timeline.push(t_et_imEye());
  }

  if (includePlaygroundCr) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: ['OK'],
      stimulus: () => `<h2>Crowding Playground</h2><br><br><br>`,
    });

    timeline.push(tr.t_initSummary({ title: "Bouma's coefficient", labelY: 'coefficient' }));
    timeline.push(tr.t_crParams());

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<h1>Slow trials</h1>',
      choices: ['OK'],
    });

    for (let i = 0; i < numTrialBlockSlow; i += 1) {
      timeline.push(
        tr.t_cr({
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
      stimulus: '<h1>Fast trials</h1>',
      choices: ['OK'],
    });

    timeline.push(tr.t_crCreateQuest());

    let iTrial = 0;
    timeline.push({
      timeline: [
        tr.t_cr({
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

    timeline.push(tr.t_plotSummary());
  }

  // =================================================================
  // EVAL TASK
  // =================================================================

  if (includeEvalTask) {
    // TODO: register in map trials
    timeline.push(t_instructionTech({}, '@eval-welcome'));

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'sharedTechIconRulerAll',
        },
        '@eval-setup-ruler',
      ),
    );

    timeline.push(t_screenMeasureWidth({}));

    timeline.push(t_instructionTech({}, '@eval-test-structure'));

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'taskFixationAll',
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        '@eval-keep-fixation',
      ),
    );

    // =====================================================
    // SHAPE_IDENT - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'taskShapeIdentSameFlankAll',
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        '@eval-task-shape-ident',
      ),
    );

    timeline.push(t_instructionTech({}, '@eval-slow-trials'));

    // const metaparamsShapeIdent = {
    //   typeTask: TypeTask.SHAPE_IDENT,
    //   namesStim: ["butterfly", "car", "tree", "duck", "heart", "rocket"],
    // };

    const metaparamsShapeIdent = {
      typeTask: TypeTask.SHAPE_IDENT,
      namesStim: ['butterfly', 'car', 'duck', 'heart', 'rocket'],
      _sameFlank: true,
      _nameFlank: 'cloud',
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
          nameBlock: 'shape-ident-practice',
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, '@eval-fast-trials'));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeIdent,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: 'shape-ident-test',
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
          title: "Bouma's coefficient",
          labelY: 'coefficient',
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(tr.t_plotSummary());
    }

    // =====================================================
    // SHAPE_COMPARE_REF - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'taskShapeCompareRefSameFlankAll',
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        '@eval-task-shape-compare-ref',
      ),
    );

    timeline.push(t_instructionTech({}, '@eval-slow-trials'));

    const metaparamsShapeCompareRef = {
      typeTask: TypeTask.SHAPE_COMPARE_REF,
      namesStim: ['butterfly', 'car', 'duck', 'heart', 'rocket'],
      _sameFlank: true,
      _nameFlank: 'cloud',
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
          nameBlock: 'shape-compare-ref-practice',
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, '@eval-fast-trials'));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeCompareRef,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: 'shape-compare-ref-test',
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
          title: "Bouma's coefficient",
          labelY: 'coefficient',
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(tr.t_plotSummary());
    }

    // =====================================================
    // SHAPE_COMPARE_LR - same flankers
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'taskShapeCompareLrSameFlankAll',
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        '@eval-task-shape-compare-lr',
      ),
    );

    timeline.push(t_instructionTech({}, '@eval-slow-trials'));

    const metaparamsShapeCompareLr = {
      typeTask: TypeTask.SHAPE_COMPARE_LR,
      namesStim: ['butterfly', 'car', 'duck', 'heart', 'rocket'],
      _nameFlank: 'cloud',
      _sameFlank: true,
      // showFlankHor: false,
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
          nameBlock: 'shape-compare-lr-practice',
        },
      }),
    );
    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, '@eval-fast-trials'));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsShapeCompareLr,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: 'shape-compare-lr-test',
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
          title: "Bouma's coefficient",
          labelY: 'coefficient',
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(tr.t_plotSummary());
    }

    // =====================================================
    // ORIENT_IDENT
    // =====================================================

    timeline.push(
      t_instructionTech(
        {
          keyImg: 'taskOrientIdentAll',
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        '@eval-task-orient-ident',
      ),
    );

    timeline.push(t_instructionTech({}, '@eval-slow-trials'));

    const metaparamsOrientIdent = {
      typeTask: TypeTask.ORIENT_IDENT,
      namesStim: ['rocket', 'cloud'],
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
          nameBlock: 'orient-ident-practice',
        },
      }),
    );

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlockSlow,
      }),
    );

    timeline.push(t_instructionTech({}, '@eval-fast-trials'));

    timeline.push(
      t_setParamsBlockCr({
        metaparams: metaparamsOrientIdent,
        info: {
          stageAssessment: AssessmentStage.TEST,
          nameBlock: 'orient-ident-test',
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
          title: "Bouma's coefficient",
          labelY: 'coefficient',
        }),
      );
    }

    timeline.push(
      t_createBlockCr({
        numTrial: numTrialBlock,
      }),
    );

    if (showSummary) {
      timeline.push(tr.t_plotSummary());
    }

    // ===========================================================================
    // ===========================================================================
    // ===========================================================================

    // =====================================================
    // ORIENT_COMPARE_LR
    // =====================================================
    /*    
    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskOrientCompareLrAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-orient-compare-lr",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeCompareLr = {
      typeTask: TypeTask.ORIENT_COMPARE_LR,
      namesStim: ["rocket", "cloud"],
      showFlankHor: false,
      anglesTarg: [-30, 30],
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
          nameBlock: "orient-compare-lr-practice",
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
          nameBlock: "orient-compare-lr-test",
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
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
      timeline.push(tr.t_plotSummary());
    }
    */

    // =====================================================
    // SHAPE_COMPARE_LR
    // =====================================================
    /*
    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskShapeCompareLrAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-shape-compare-lr",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeCompareLr = {
      typeTask: TypeTask.SHAPE_COMPARE_LR,
      namesStim: ["butterfly", "car", "tree", "duck", "heart", "rocket"],
      showFlankHor: false,
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

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
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
      timeline.push(tr.t_plotSummary());
    }
    */
    // =====================================================
    // ORIENT_COMPARE_REF
    // =====================================================
    /*
    timeline.push(
      t_instructionTech(
        {
          keyImg: "taskOrientCompareRefAll",
          typeSizeImg: TypeSize.LARGE,
          borderImg: true,
        },
        "@eval-task-orient-compare-ref",
      ),
    );

    timeline.push(t_instructionTech({}, "@eval-slow-trials"));

    const metaparamsShapeCompareRef = {
      typeTask: TypeTask.ORIENT_COMPARE_REF,
      namesStim: ["rocket", "cloud"],
      anglesTarg: [-30, 30],
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
          nameBlock: "orient-compare-ref-practice",
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
          nameBlock: "orient-compare-ref-test",
        },
      }),
    );

    timeline.push(tr.t_crCreateQuest());

    if (showSummary) {
      timeline.push(
        tr.t_initSummary({
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
      timeline.push(tr.t_plotSummary());
    }
    */
    // =====================================================
    // SURVEY
    // =====================================================

    timeline.push(t_instructionTech({}, '@eval-take-survey'));

    const paramsSurvey = {
      titlesCol: ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard'],
      namesRow: ['shape-ident', 'shape-compare-ref', 'shape-compare-lr', 'orient-ident'],
      keysImgRow: [
        'taskShapeIdentSameFlankAll',
        'taskShapeCompareRefSameFlankAll',
        'taskShapeCompareLrSameFlankAll',
        'taskOrientIdentAll',
      ], // []
    };

    const paramsSurveyDifficult = {
      ...paramsSurvey,
      title: 'How easy was each task?',
      subtitle: 'Consider your level of frustration',
      nameSurvey: 'survey-difficult',
    };

    const paramsSurveyAwkward = {
      ...paramsSurvey,
      title: 'How easy was it to map your answer to the response buttons or keys?',
      subtitle: 'Consider the cognitive or motor effort required',
      nameSurvey: 'survey-awkward',
    };

    timeline.push(t_surveyRatingRadio(paramsSurveyDifficult));

    timeline.push(t_surveyRatingRadio(paramsSurveyAwkward));

    const paramsSurveyText = {
      title: 'Please share any additional comments',
      nameSurvey: 'survey-comments',
    };

    timeline.push(t_surveyText(paramsSurveyText));

    timeline.push(t_instructionTech({}, '@eval-end-screen'));
  }

  timeline.push(tr.t_exitFullscreen());

  return { timeline };
};
