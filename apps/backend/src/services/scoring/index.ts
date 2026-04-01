export {
  getSupportLevel,
  getRawScoreThreshold,
  resolveScoreFieldNames,
  resolveScoreFieldName,
} from './scoring.service';
export { getScoringConfig, getRegisteredSlugs } from './scoring.config-registry';
export { ScoringConfigSchema, SCORE_FIELD_TYPES } from './scoring.config-schema';
export type {
  ScoringConfig,
  ScoreFieldType,
  GradeConditionalField,
  FieldNameValue,
  Classification,
} from './scoring.config-schema';
export type { SupportLevel, ScoringInput, RawScoreThreshold, ScoreFieldResolution } from './scoring.types';
