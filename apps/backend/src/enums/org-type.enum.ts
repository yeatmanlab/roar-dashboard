/**
 * Org Type Enum
 *
 * Enumerates the available org types following the OneRoster spec v1.1
 * @see {@link https://www.imsglobal.org/oneroster-v11-final-specification#_Toc480452024}
 */
import { orgTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

const OrgType = pgEnumToConst(orgTypeEnum);

export type OrgType = (typeof orgTypeEnum.enumValues)[number];
export default OrgType;
