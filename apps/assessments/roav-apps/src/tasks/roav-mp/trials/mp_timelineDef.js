import { mapTrials } from '../../shared/trials/mapTrials';
import { mp_mapTrials } from './mp_mapTrials';
import {
  ModeGame,
  ModeInput,
  ModeSeq,
  SubtypeTrial,
  AssessmentStage,
  TypeKey,
} from '../../shared/helpers/namingHelpers';
import { VALIDATION, RDK, COHERENCE } from '../helpers/mp_constants';
import { DURATIONS } from '../../shared/helpers/constants';
import { DirRdk } from './mp_rdk';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from '../helpers/mp_sessionKeys';

const tr = {
  ...mapTrials,
  ...mp_mapTrials,
};

export const t_timelineDef = () => {
  const configBlock = sessionGet(SK.RDK_CONFIG_BLOCK);
  const configQuest = sessionGet(SK.RDK_CONFIG_QUEST);

  const arrTrials = [];

  arrTrials.push(tr.t_enterFullscreen(true));

  arrTrials.push(tr.t_enterLandscape());

  arrTrials.push(tr.t_installTouchGuards());

  arrTrials.push(tr.t_collectDataMonitor());

  arrTrials.push(tr.t_createQuest(configQuest.params));

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        animateBtn: true,
        durationTrial: DURATIONS.WAIT_FOR_RESPONSE,
      },
      'intro',
    ),
  );

  // allow any input modality
  arrTrials.push(tr.t_setAllowModeInputAll(true));
  arrTrials.push(tr.t_initModeInputTargetRdk());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-others-flying-away'],
        modeGameTrial: ModeGame.GAME,
        modeGameSkipResponse: ModeGame.GAME,
      },
      'instr-task',
    ),
  );

  arrTrials.push(
    tr.t_instructionInputLR(
      {
        enableBtnLeft: true,
        enableBtnRight: true,
        animateBtnLeft: true,
        animateBtnRight: true,
        allowInputKeyAny: false,
        modeGameTrial: ModeGame.STANDARD,
        modeInputTargetAnswerTrial: ModeInput.ALL,
        modeInputTargetTrial: ModeInput.ALL,
      },
      'instr-input-all',
    ),
  );

  arrTrials.push(tr.t_timelineInputMode());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'swarms-left-right'],
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'alt-instr-ready-to-watch-right',
    ),
  );

  // ==================================
  // block-instruction
  // ==================================

  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {
        trial_duration: RDK.DURATION_AUDIO,
        _subtype_trial: SubtypeTrial.CONST,
        coherence: COHERENCE.COH_96,
        number_of_dots: RDK.NUMBER_OF_DOTS_DEMO,
        border: true,
        _dot_life: RDK.DOT_LIFE_DEMO,
        _fixation_duration_pre: 0,
      },
      info: {
        nameBlock: 'block-instruction',
        stageAssessment: AssessmentStage.INSTRUCTION,
        evaluateValidity: false,
        playAudio: true,
        gapColorSameAsBorder: true,
        animateFade: false,
        keyImgBtnLeft: ['rdk', '', 'button-key-left'],
        keyImgBtnRight: ['rdk', '', 'button-key-right'],
      },
    }),
  );

  arrTrials.push(
    tr.t_rdk(
      {
        metaparams: {
          trial_duration: RDK.DURATION_DEMO,
          _coherent_direction: DirRdk.RIGHT,
          choices: [TypeKey.DUMMY, TypeKey.ARROW_RIGHT],
        },
        info: {
          animateBtnRight: true,
          enableBtnLeft: false,
          showBtnLeft: false,
        },
      },
      'instr-demo-right',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'alt-instr-response-right',
    ),
  );

  arrTrials.push(
    tr.t_rdk(
      {
        metaparams: {
          trial_duration: RDK.DURATION_DEMO,
          _coherent_direction: DirRdk.LEFT,
          choices: [TypeKey.ARROW_LEFT, TypeKey.DUMMY],
        },
        info: {
          animateBtnLeft: true,
          showBtnRight: false,
          enableBtnRight: false,
        },
      },
      'instr-demo-left',
    ),
  );

  // ==================================
  // block-practice-feedback-av
  // ==================================

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'characters-objects-left-right'],
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'practice-ready-to-watch-feedback',
    ),
  );

  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {
        _subtype_trial: SubtypeTrial.CONST,
        trial_duration: RDK.DURATION_PRACTICE_AV,
        number_of_dots: RDK.NUMBER_OF_DOTS_PRACTICE_AV,
        border: true,
      },
      info: {
        stageAssessment: AssessmentStage.PRACTICE,
        nameBlock: 'block-practice-feedback-av',
        evaluateValidity: false,
        keyAudio: ['rdk', 'practice-feedback', ''],
        textBanner: ['rdk', 'practice-feedback', 'text2'],
        playAudio: true,
        gapColorSameAsBorder: true,
        keyImgBtnLeft: ['rdk', '', 'button-key-left'],
        keyImgBtnRight: ['rdk', '', 'button-key-right'],
      },
    }),
  );

  arrTrials.push(
    tr.t_createBlockRdk({
      playFeedbackAv: true,
      modeSeq: ModeSeq.ALL,
      arrMetaparams: [
        { coherence: COHERENCE.COH_96, _coherent_direction: DirRdk.RIGHT },
        { coherence: COHERENCE.COH_96, _coherent_direction: DirRdk.LEFT },
      ],
    }),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-objects'],
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'practice-ready-to-watch-no-feedback',
    ),
  );

  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {
        _subtype_trial: SubtypeTrial.CONST,
        trial_duration: RDK.DURATION_PRACTICE,
      },
      info: {
        stageAssessment: AssessmentStage.PRACTICE,
        nameBlock: 'block-practice-1',
        showTextBanner: false,
      },
    }),
  );

  arrTrials.push(
    tr.t_createBlockRdk({
      modeSeq: ModeSeq.ALL,
      arrMetaparams: [
        { coherence: COHERENCE.COH_96, _coherent_direction: DirRdk.LEFT },
        { coherence: COHERENCE.PRACTICE, _coherent_direction: DirRdk.LEFT },
        { coherence: COHERENCE.PRACTICE, _coherent_direction: DirRdk.RIGHT },
        { coherence: COHERENCE.COH_96, _coherent_direction: DirRdk.RIGHT },
      ],
    }),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-reward-4'],
        modeGameTrial: ModeGame.GAME,
        modeGameSkipResponse: ModeGame.GAME,
      },
      'practice-reward-after-no-feedback',
    ),
  );

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        durationTrial: DURATIONS.BREAK,
        animateBtn: true,
      },
      'instr-take-best-guess',
    ),
  );

  arrTrials.push(
    tr.t_createValidityEvaluator({
      responseTimeLowThreshold: VALIDATION.RESPONSE_TIME_LOW_THRESHOLD,
      accuracyThreshold: VALIDATION.ACCURACY_THRESHOLD,
    }),
  );

  // ==================================
  // block-test-1
  // ==================================

  arrTrials.push(tr.t_startNewBlockValidation('block-test-1'));
  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {},
      info: {
        stageAssessment: AssessmentStage.TEST,
        nameBlock: 'block-test-1',
        showTextBanner: false,
      },
      reset: true,
    }),
  );

  arrTrials.push(
    tr.t_createBlockRdk({
      modeSeq: ModeSeq.RANDOM,
    }),
  );

  arrTrials.push(
    tr.t_createBlockRdk({
      modeSeq: ModeSeq.FIXED,
      arrMetaparams: configBlock?.arrsMetaparams?.[0],
    }),
  );

  arrTrials.push(tr.t_setEnableTrialsIfValidationPassed(false));
  arrTrials.push(tr.t_markAsCompletedValidation());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-objects'],
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'reminder',
    ),
  );

  arrTrials.push(tr.t_setEnableTrials(true));

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-reward-6'],
        durationTrial: DURATIONS.BREAK,
        animateBtn: true,
      },
      'test-break-after-block-1',
    ),
  );

  // ==================================
  // block-test-2
  // ==================================

  arrTrials.push(tr.t_startNewBlockValidation('block-test-2'));
  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {},
      info: {
        stageAssessment: AssessmentStage.TEST,
        nameBlock: 'block-test-2',
        showTextBanner: false,
      },
      reset: false,
    }),
  );

  arrTrials.push(tr.t_createBlockRdk({ modeSeq: ModeSeq.RANDOM }));

  arrTrials.push(
    tr.t_createBlockRdk({
      modeSeq: ModeSeq.FIXED,
      arrMetaparams: configBlock?.arrsMetaparams?.[1],
    }),
  );

  arrTrials.push(tr.t_setEnableTrialsIfValidationPassed(false));
  arrTrials.push(tr.t_markAsCompletedValidation());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-objects'],
        animateBtn: true,
        modeGameSkipResponse: ModeGame.ALL, // @new
      },
      'reminder',
    ),
  );

  arrTrials.push(tr.t_setEnableTrials(true));

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        keyImgCharacter: ['', '', 'character-reward-7'],
        durationTrial: DURATIONS.BREAK,
        animateBtn: true,
      },
      'test-break-after-block-2',
    ),
  );

  // ==================================
  // block-test-3
  // ==================================

  arrTrials.push(tr.t_startNewBlockValidation('block-test-3'));
  arrTrials.push(
    tr.t_setParamsBlockRdk({
      metaparams: {},
      info: {
        stageAssessment: AssessmentStage.TEST,
        nameBlock: 'block-test-3',
        showTextBanner: false,
      },
      reset: false,
    }),
  );

  arrTrials.push(tr.t_createBlockRdk({ modeSeq: ModeSeq.RANDOM }));

  arrTrials.push(
    tr.t_createBlockRdk({
      modeSeq: ModeSeq.FIXED,
      arrMetaparams: configBlock?.arrsMetaparams?.[2],
    }),
  );

  arrTrials.push(tr.t_markAsCompletedValidation());

  arrTrials.push(
    tr.t_instructionGeneral(
      {
        animateBtn: true,
        keyImgCharacter: ['', '', 'character-reward-8'],
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
