import { t_instructionGeneral } from './instructionGeneral';
import { t_instructionInputLR } from './instructionInputLR';
import { t_feedbackAudioVisual } from './feedbackAudioVisual';
import { t_collectDataMonitor } from './collectDataMonitor';
import { t_collectUserData } from './userDataHelpers';
import { t_preloadTrials } from './preloadTrials';
import { t_createQuest } from './questHelpers';
import { t_initSummary, t_writeSummary, t_plotSummary } from './summaryHelpers';
import {
  t_setEnableTrials,
  t_setEnableTrialsByModeGame,
  t_setEnableTrialsByDataCorrect,
  t_setEnableTrialsByModeInputTarget,
  t_enableTrialsOnlyInModeInputTarget,
  t_disableTrialsOnlyInModeInputTarget,
  t_enableTrialsOnlyInModeGame,
  t_disableTrialsOnlyInModeGame,
  t_setEnableTrialsByModeSeq,
} from './flowHelpers';
import {
  t_installTouchGuards,
  t_uninstallTouchGuards,
  t_enterFullscreen,
  t_exitFullscreen,
  t_enterLandscape,
} from './screenHelpers';
import {
  t_setAllowModeInputAll,
  t_initModeInputTarget,
  t_setModeInputTarget,
  t_updateModeInputTarget,
} from './inputModeHelpers';
import {
  t_createValidityEvaluator,
  t_startNewBlockValidation,
  t_markAsCompletedValidation,
  t_setEnableTrialsIfValidationFailed,
  t_setEnableTrialsIfValidationPassed,
  t_setEnableTrialsByValidation,
} from './validityHelpers';
import { t_saveConfig } from './configHelpers';

export const mapTrials = {
  t_instructionGeneral,
  t_instructionInputLR,
  t_feedbackAudioVisual,
  t_collectDataMonitor,
  t_collectUserData,
  t_preloadTrials,
  t_createQuest,
  t_initSummary,
  t_writeSummary,
  t_plotSummary,
  t_setEnableTrials,
  t_setEnableTrialsByModeGame,
  t_setEnableTrialsByDataCorrect,
  t_setEnableTrialsByModeInputTarget,
  t_enableTrialsOnlyInModeInputTarget,
  t_disableTrialsOnlyInModeInputTarget,
  t_enableTrialsOnlyInModeGame,
  t_disableTrialsOnlyInModeGame,
  t_setEnableTrialsByModeSeq,
  t_installTouchGuards,
  t_uninstallTouchGuards,
  t_enterFullscreen,
  t_exitFullscreen,
  t_enterLandscape,
  t_initModeInputTarget,
  t_setModeInputTarget,
  t_updateModeInputTarget,
  t_setAllowModeInputAll,
  t_createValidityEvaluator,
  t_startNewBlockValidation,
  t_markAsCompletedValidation,
  t_setEnableTrialsIfValidationFailed,
  t_setEnableTrialsIfValidationPassed,
  t_setEnableTrialsByValidation,
  t_saveConfig,
};
