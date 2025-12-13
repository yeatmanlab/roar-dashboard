/**
 * User Role Enum
 *
 * Enumerates the available roles a user can be assigned.
 */
import { userRoleEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const UserRole = pgEnumToConst(userRoleEnum);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export default UserRole;
