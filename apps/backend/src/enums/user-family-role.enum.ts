/**
 * User Family Role Enum
 *
 * Enumerates the available roles a user can be assigned within a family.
 */
import { userFamilyRoleEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const UserFamilyRole = pgEnumToConst(userFamilyRoleEnum);

export type UserFamilyRole = (typeof userFamilyRoleEnum.enumValues)[number];
