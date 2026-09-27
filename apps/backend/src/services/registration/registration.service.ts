import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import { logger } from '../../logger';
import { AgreementService, REGISTRATION_AGREEMENT_TYPES } from '../agreement/agreement.service';
import { FamilyService } from '../family/family.service';

interface RegistrationName {
  first: string;
  middle?: string | undefined;
  last: string;
}

interface RegistrationLocation {
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  stateProvince?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
}

export interface RegistrationServiceInput {
  email: string;
  password: string;
  name: RegistrationName;
  location?: RegistrationLocation | undefined;
  agreementVersionIds: string[];
  optIns: {
    researchContact: boolean;
  };
}

type AgreementServiceInstance = Pick<ReturnType<typeof AgreementService>, 'getRegistrationAgreements'>;
type FamilyServiceInstance = Pick<ReturnType<typeof FamilyService>, 'create'>;

/**
 * Coordinates public registration agreement reads and account registration.
 * Agreement validation always completes before FamilyService performs a write.
 */
export function RegistrationService({
  agreementService = AgreementService(),
  agreementVersionRepository = new AgreementVersionRepository(),
  familyService = FamilyService(),
}: {
  agreementService?: AgreementServiceInstance;
  agreementVersionRepository?: AgreementVersionRepository;
  familyService?: FamilyServiceInstance;
} = {}) {
  async function getAgreements(locale: string) {
    return agreementService.getRegistrationAgreements(locale);
  }

  async function register(input: RegistrationServiceInput): Promise<void> {
    const { agreementVersionIds } = input;

    try {
      const uniqueVersionIds = new Set(agreementVersionIds);
      if (uniqueVersionIds.size !== agreementVersionIds.length) {
        throwInvalidAgreementSet({ reason: 'duplicate agreement version' });
      }

      const [submittedVersions, requiredAgreementIds] = await Promise.all([
        agreementVersionRepository.getRegistrationCandidatesByIds(agreementVersionIds),
        agreementVersionRepository.listRequiredRegistrationAgreementIds(REGISTRATION_AGREEMENT_TYPES),
      ]);

      if (submittedVersions.length !== agreementVersionIds.length || requiredAgreementIds.length === 0) {
        throwInvalidAgreementSet({
          reason: 'missing submitted or configured agreement version',
          submittedCount: agreementVersionIds.length,
          resolvedCount: submittedVersions.length,
          requiredCount: requiredAgreementIds.length,
        });
      }

      const requiredSet = new Set(requiredAgreementIds);
      const submittedAgreementIds = new Set<string>();

      for (const version of submittedVersions) {
        if (
          !version.isCurrent ||
          !REGISTRATION_AGREEMENT_TYPES.some((agreementType) => agreementType === version.agreementType) ||
          !requiredSet.has(version.agreementId) ||
          submittedAgreementIds.has(version.agreementId)
        ) {
          throwInvalidAgreementSet({
            reason: 'stale, non-signable, unexpected, or duplicate agreement',
            agreementVersionId: version.agreementVersionId,
          });
        }
        submittedAgreementIds.add(version.agreementId);
      }

      if (requiredAgreementIds.some((agreementId) => !submittedAgreementIds.has(agreementId))) {
        throwInvalidAgreementSet({ reason: 'required agreement missing' });
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error }, 'Failed to validate registration agreements');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        cause: error,
      });
    }

    // optIns.researchContact follows the API opt-in envelope convention. Its
    // relational persistence is intentionally deferred to the opt-in domain;
    // it must never be represented as a legal agreement acceptance.
    await familyService.create({
      email: input.email,
      password: input.password,
      name: input.name,
      location: input.location,
      agreementVersionIds,
    });
  }

  function throwInvalidAgreementSet(context: Record<string, unknown>): never {
    throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      context,
    });
  }

  return { getAgreements, register };
}
