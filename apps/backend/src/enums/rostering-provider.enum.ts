/**
 * Rostering Provider Enum
 *
 * Enumerates the available rostering providers.
 */
import { rosteringProviderEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const RosteringProvider = pgEnumToConst(rosteringProviderEnum);

export type RosteringProvider = (typeof rosteringProviderEnum.enumValues)[number];
export default RosteringProvider;
