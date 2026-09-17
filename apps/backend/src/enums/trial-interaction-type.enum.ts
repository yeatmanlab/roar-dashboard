/**
 * Trial Interaction Type Enum
 *
 * Enumerates the available trial interaction types.
 */
import { trialInteractionTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const TrialInteractionType = pgEnumToConst(trialInteractionTypeEnum);

export type TrialInteractionType = (typeof trialInteractionTypeEnum.enumValues)[number];
