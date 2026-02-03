/**
 * Free/Reduced Lunch Status Enum
 *
 * Enumerates the available free/reduced lunch status.
 */
import { freeReducedLunchStatusEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const FreeReducedLunchStatus = pgEnumToConst(freeReducedLunchStatusEnum);

export type FreeReducedLunchStatus = (typeof freeReducedLunchStatusEnum.enumValues)[number];
