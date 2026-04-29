import { userRoleEnum, userFamilyRoleEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

/**
 * User Role Enum
 *
 * Enumerates the available roles a user can be assigned.
 */
export const UserRole = pgEnumToConst(userRoleEnum);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * User Family Role Enum
 *
 * Enumerates the available roles a user can be assigned in a family context.
 */
export const UserFamilyRole = pgEnumToConst(userFamilyRoleEnum);
export type UserFamilyRole = (typeof userFamilyRoleEnum.enumValues)[number];
