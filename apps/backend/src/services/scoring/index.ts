export {
  parseScoreValue,
  getSupportLevel,
  getRawScoreThreshold,
  resolveScoreFieldNames,
  resolveScoreFieldName,
  getSupportLevelFieldName,
  getSubscoresConfig,
  PA_SKILL_THRESHOLD,
  PA_SKILL_LEGACY_THRESHOLD,
  PA_SUBTASK_KEYS,
} from './scoring.service';
export type { PaSubtaskKey } from './scoring.service';
export { getScoringConfig, getRegisteredSlugs } from './scoring.config-registry';
export { ScoringConfigSchema, SCORE_FIELD_TYPES } from './scoring.config-schema';
export {
  getTaskSubscoreColumns,
  getPublicSubscoreColumns,
  getNumericFieldNameForSubscore,
  formatTaskSubscoreColumnValue,
} from './subscore-table.registry';
export type {
  TaskSubscoreColumnDef,
  ItemLevelColumn,
  NumberColumn,
  StringPassthroughColumn,
  PaSkillsToWorkOnColumn,
} from './subscore-table.registry';
export type {
  ScoringConfig,
  ScoreFieldType,
  GradeConditionalField,
  FieldNameValue,
  Classification,
} from './scoring.config-schema';
export type { SupportLevel, ScoringInput, RawScoreThreshold, ScoreFieldResolution } from './scoring.types';
