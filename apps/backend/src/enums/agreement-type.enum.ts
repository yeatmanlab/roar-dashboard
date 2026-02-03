/**
 * Agreement Type Enum
 *
 * Enumerates the available agreement types.
 */
import { agreementTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const AgreementType = pgEnumToConst(agreementTypeEnum);

export type AgreementType = (typeof agreementTypeEnum.enumValues)[number];
