/**
 * Auth Provider Enum
 *
 * Enumerates the available authentication providers.
 */
import { authProviderEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const AuthProvider = pgEnumToConst(authProviderEnum);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];
export default AuthProvider;
