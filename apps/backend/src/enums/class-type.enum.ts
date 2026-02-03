/**
 * Class Type Enum
 *
 * Enumerates the available class types following the OneRoster spec.
 */
import { classTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const ClassType = pgEnumToConst(classTypeEnum);

export type ClassType = (typeof classTypeEnum.enumValues)[number];
