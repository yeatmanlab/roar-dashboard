/**
 * User Type Enum
 *
 * Enumerates the available user types derived from the OneRoster specs.
 */
import { userTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const UserType = pgEnumToConst(userTypeEnum);

export type UserType = (typeof userTypeEnum.enumValues)[number];
