/**
 * Score Type Enum
 *
 * Enumerates the available score types.
 */
import { scoreTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const ScoreType = pgEnumToConst(scoreTypeEnum);

export type ScoreType = (typeof scoreTypeEnum.enumValues)[number];
export default ScoreType;
