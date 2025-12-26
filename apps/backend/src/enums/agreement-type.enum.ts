/**
 * Agreement Type Enum
 *
 * Enumerates the available agreement types.
 */
import { agreementTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const AgreementType = pgEnumToConst(agreementTypeEnum);

export type AgreementType = (typeof agreementTypeEnum.enumValues)[number];
export default AgreementType;
