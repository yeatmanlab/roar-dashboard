import { AgreementType } from '../enums/agreement-type.enum';

export { DEFAULT_REGISTRATION_LOCALE } from '@roar-platform/api-contract';

export const REGISTRATION_AGREEMENT_TYPES = [AgreementType.CONSENT, AgreementType.TOS] as const;
