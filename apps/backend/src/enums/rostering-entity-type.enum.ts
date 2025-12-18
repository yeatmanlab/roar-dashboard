/**
 * Rostering Entity Type Enum
 *
 * Enumerates the available rostering entity types following the OneRoster spec.
 */
import { rosteringEntityTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const RosteringEntityType = pgEnumToConst(rosteringEntityTypeEnum);

export type RosteringEntityType = (typeof rosteringEntityTypeEnum.enumValues)[number];
export default RosteringEntityType;
