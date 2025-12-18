/**
 * Rostering Entity Status Enum
 *
 * Enumerates the available rostering entity statuses following the OneRoster spec.
 */
import { rosteringEntityStatusEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const RosteringEntityStatus = pgEnumToConst(rosteringEntityStatusEnum);

export type RosteringEntityStatus = (typeof rosteringEntityStatusEnum.enumValues)[number];
export default RosteringEntityStatus;
