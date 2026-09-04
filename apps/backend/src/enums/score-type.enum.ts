/**
 * Score Type Enum
 *
 * Enumerates the available score types.
 */
import { scoreTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const ScoreType = pgEnumToConst(scoreTypeEnum);

export type ScoreType = (typeof scoreTypeEnum.enumValues)[number];
