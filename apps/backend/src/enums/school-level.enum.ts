/**
 * School Level Enum
 *
 * Enumerates the available school levels, usually automatically derived from the grade.
 */
import { schoolLevelEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const SchoolLevel = pgEnumToConst(schoolLevelEnum);

export type SchoolLevel = (typeof schoolLevelEnum.enumValues)[number];
