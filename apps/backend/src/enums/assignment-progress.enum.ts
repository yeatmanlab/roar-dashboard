/**
 * Assignment Progress Enum
 *
 * Enumerates the available assignment progress states.
 */
import { assignmentProgressEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const AssignmentProgress = pgEnumToConst(assignmentProgressEnum);

export type AssignmentProgress = (typeof assignmentProgressEnum.enumValues)[number];
