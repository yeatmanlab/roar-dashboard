/**
 * Group Type Enum
 *
 * Enumerates the available group types.
 */
import { groupTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const GroupType = pgEnumToConst(groupTypeEnum);

export type GroupType = (typeof groupTypeEnum.enumValues)[number];
