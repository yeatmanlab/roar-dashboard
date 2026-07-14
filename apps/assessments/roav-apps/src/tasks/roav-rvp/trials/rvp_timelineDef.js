import { mapTrials } from '../../shared/trials/mapTrials';
import { rvp_mapTrials } from './rvp_mapTrials';
import { ModeGame, AssessmentStage } from '../../shared/helpers/namingHelpers';
import { DURATIONS } from '../../shared/helpers/constants';
import { ModeSelStim, TypeStimRvp } from './rvp_rvpTrial';
import { VALIDATION, RVP } from '../helpers/rvp_constants';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from '../helpers/rvp_sessionKeys';

const tr = {
  ...mapTrials,
  ...rvp_mapTrials,
};

export const t_timelineDef = () => {
  const modeGame = sessionGet(SK.MODE_GAME);

  const arrTrials = [];

  arrTrials.push(tr.t_saveConfigBlockStim());

  arrTrials.push(tr.t_enterFullscreen(true));

  arrTrials.push(tr.t_enterLandscape());

  arrTrials.push(tr.t_installTouchGuards());

  arrTrials.push(tr.t_collectDataMonitor());

  arrTrials.push(tr.t_setAllowModeInputAll(true));

  arrTrials.push(tr.t_initCatsAll());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        animateBtn: true,
        durationTrial: DURATIONS.WAIT_FOR_RESPONSE,
      },
      'intro',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        modeGameSkipResponse: ModeGame.ALL,
      },
      'instr-task-1',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'map-0'],
        modeGameSkipResponse: ModeGame.ALL,
        modeGameTrial: ModeGame.GAME,
      },
      'instr-task-2',
    ),
  );

  // ==================================
  // block-instruction
  // ==================================

  // instr-demo-1

  arrTrials.push(
    tr.t_setParamsBlockRvp({
      metaparams: {
        typeStim: TypeStimRvp.OPTO,
        modeSelStim: ModeSelStim.NAME,
        numStim: 2,
        namesStim: ['tree', 'flower'],
        posTarg: 1,
        durationResp: RVP.DURATION_RESP_DEMO_MAX,
      },
      info: {
        nameBlock: 'block-instr-demo-1',
        stageAssessment: AssessmentStage.INSTRUCTION,
        evaluateValidity: false,
        playAudio: true,
        showImgBg: modeGame === ModeGame.GAME,
        keyImgBg: ['', '', 'bg-blank'],
        animateMarkFix: true,
        animateMarkTarg: true,
        animateBtnResp: true,
      },
    }),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          durationMarkTarg: 0,
        },
        info: {
          includeTrialResp: false,
        },
      },
      'instr-demo-1-start',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          posTarg: 0,
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {
          includeTrialResp: false,
          animateStimTarg: true,
        },
      },
      'instr-demo-1-pos-0',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {
          includeTrialResp: false,
          animateStimTarg: true,
        },
      },
      'instr-demo-1-pos-1',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          durationMarkFix: 0,
        },
        info: {
          disableBtnsRespNonTarg: true,
        },
      },
      'instr-demo-1-end',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'map-1'],
        keyImgBg: ['', '', 'bg-opto'],
        modeGameSkipResponse: ModeGame.ALL,
      },
      'instr-after-demo-1',
    ),
  );

  // instr-demo-2 =====================================
  arrTrials.push(
    tr.t_setParamsBlockRvp({
      metaparams: {
        typeStim: TypeStimRvp.OPTO,
        modeSelStim: ModeSelStim.NAME,
        numStim: 4,
        namesStim: ['rabbit', 'car', 'butterfly', 'duck'],
        posTarg: 0,
        durationResp: RVP.DURATION_RESP_DEMO_MAX,
      },
      info: {
        nameBlock: 'block-instr-demo-2',
        stageAssessment: AssessmentStage.INSTRUCTION,
        evaluateValidity: false,
        playAudio: true,
        showImgBg: modeGame === ModeGame.GAME,
        keyImgBg: ['', '', 'bg-blank'],
        animateBtnResp: true,
        animateStimTarg: true,
        includeTrialResp: false,
      },
    }),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          durationMarkTarg: 0,
        },
        info: {
          animateStimTarg: false,
        },
      },
      'instr-demo-2-start',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          posTarg: 0,
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {
          includeTrialResp: false,
        },
      },
      'instr-demo-2-pos-0',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          posTarg: 1,
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {},
      },
      'instr-demo-2-pos-1',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          posTarg: 2,
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {},
      },
      'instr-demo-2-pos-2',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          posTarg: 3,
          durationMarkFix: 0,
          durationMarkTarg: 0,
        },
        info: {},
      },
      'instr-demo-2-pos-3',
    ),
  );

  arrTrials.push(
    tr.t_rvp(
      {
        metaparams: {
          durationStim: 0,
          durationMarkFix: 0,
        },
        info: {
          animateStimTarg: false,
          includeTrialResp: true,
          disableBtnsRespNonTarg: true,
        },
      },
      'instr-demo-2-end',
    ),
  );

  // ==================================
  // block-practice-av
  // ==================================

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'map-2'],
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL,
      },
      'practice-before-practice-av',
    ),
  );

  arrTrials.push(
    tr.t_setParamsBlockRvp({
      metaparams: {
        typeStim: TypeStimRvp.OPTO,
        durationMarkFix: RVP.DURATION_MARK_FIX_PRACTICE_AV,
        durationStim: RVP.DURATION_STIM_PRACTICE_AV,
        durationResp: RVP.DURATION_RESP_PRACTICE_AV_MAX,
      },
      info: {
        nameBlock: 'block-practice-av',
        stageAssessment: AssessmentStage.PRACTICE,
        evaluateValidity: false,
        showImgBg: modeGame === ModeGame.GAME,
        keyImgBg: ['', '', 'bg-blank'],
        playAudio: true,
      },
    }),
  );

  arrTrials.push(
    tr.t_createBlockRvp({
      playFeedbackAv: true,
      tagReqRvp: 'practice-av',
      arrMetaparams: [
        { numStim: 2, posTarg: 0 },
        { numStim: 2, posTarg: 1 },
        { numStim: 2, posTarg: 0 },
        { numStim: 4, posTarg: 3 },
      ],
    }),
  );

  // ==================================
  // block-practice
  // ==================================

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'warn-fast'],
        modeGameSkipResponse: ModeGame.ALL,
      },
      'practice-before-practice',
    ),
  );

  arrTrials.push(
    tr.t_setParamsBlockRvp({
      metaparams: {
        typeStim: TypeStimRvp.OPTO,
        durationMarkFix: RVP.DURATION_MARK_FIX_PRACTICE,
        durationStim: RVP.DURATION_STIM_PRACTICE,
        durationResp: RVP.DURATION_RESP_PRACTICE_MAX,
      },
      info: {
        nameBlock: 'block-practice',
        stageAssessment: AssessmentStage.PRACTICE,
        evaluateValidity: false,
      },
    }),
  );

  arrTrials.push(
    tr.t_createBlockRvp({
      arrMetaparams: [
        { numStim: 2, posTarg: 1 },
        { numStim: 2, posTarg: 0 },
        { numStim: 2, posTarg: 0 },
        { numStim: 2, posTarg: 1 },
        { numStim: 4, posTarg: 0 },
        { numStim: 4, posTarg: 2 },
      ],
    }),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'planet-crystal'],
        modeGameTrial: ModeGame.GAME,
        modeGameSkipResponse: ModeGame.ALL,
      },
      'practice-after-practice',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'planet-crystal'],
        durationTrial: DURATIONS.BREAK,
        animateBtn: true,
      },
      'instr-take-best-guess',
    ),
  );

  // ==================================
  // block-opto
  // ==================================

  arrTrials.push(
    tr.t_createValidityEvaluator({
      responseTimeLowThreshold: VALIDATION.RESPONSE_TIME_LOW_THRESHOLD,
      accuracyThreshold: VALIDATION.ACCURACY_THRESHOLD,
    }),
  );

  arrTrials.push(tr.t_startNewBlockValidation('block-opto'));

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 0,
      tagReqInstrBefore: null,
      tagReqInstrExtra: 'test-warn-fast',
    }),
  );

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 1,
      paramsInstrBefore: {
        keyImgCharacter: ['', '', 'map-3'],
      },
    }),
  );

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 2,
      paramsInstrBefore: {
        keyImgCharacter: ['', '', 'map-4'],
      },
      tagReqInstrBefore: 'test-keep-going-half',
    }),
  );

  arrTrials.push(tr.t_setEnableTrials(true));

  arrTrials.push(tr.t_markAsCompletedValidation());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgBg: ['', '', 'bg-pseudo'],
        keyImgCharacter: ['', '', 'planet-glass'],
        durationTrial: DURATIONS.BREAK,
        animateBtn: true,
      },
      'test-break-after-block-1',
    ),
  );

  // ==================================
  // block-pseudo
  // ==================================

  arrTrials.push(tr.t_startNewBlockValidation('block-pseudo'));

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 3,
      tagReqInstrBefore: null,
      tagReqInstrExtra: 'test-warn-fast',
    }),
  );

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 4,
      paramsInstrBefore: {
        keyImgCharacter: ['', '', 'map-5'],
      },
    }),
  );

  arrTrials.push(
    tr.t_setcreateBlockRvpAdapt({
      indBlockReq: 5,
      paramsInstrBefore: {
        keyImgCharacter: ['', '', 'map-6'],
      },
      tagReqInstrBefore: 'test-keep-going-last',
    }),
  );

  arrTrials.push(tr.t_setEnableTrials(true));

  arrTrials.push(tr.t_markAsCompletedValidation());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        animateBtn: true,
        keyImgCharacter: ['', '', 'planet-earth'],
        durationTrial: DURATIONS.BREAK,
      },
      'end-screen',
    ),
  );

  arrTrials.push(tr.t_exitFullscreen());

  arrTrials.push(tr.t_uninstallTouchGuards());

  return {
    timeline: arrTrials,
  };
};
