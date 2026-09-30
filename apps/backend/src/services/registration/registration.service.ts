import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import { logger } from '../../logger';
import { AgreementService } from '../agreement/agreement.service';
import type { RegistrationAgreementVersion } from '../../repositories/agreement-version.repository';
import { FamilyService } from '../family/family.service';
import type { CreateFamilyServiceInput } from '../family/family.service';
import { DEFAULT_REGISTRATION_LOCALE } from '../../constants/registration-agreements';
import { AgreementType } from '../../enums/agreement-type.enum';

type RegistrationName = CreateFamilyServiceInput['name'];
type RegistrationLocation = CreateFamilyServiceInput['location'];
type RegistrationOptIns = NonNullable<CreateFamilyServiceInput['optIns']>;

export interface RegistrationServiceInput {
  email: string;
  password: string;
  name: RegistrationName;
  location?: RegistrationLocation | undefined;
  agreementVersionIds: string[];
  optIns: RegistrationOptIns;
}

type AgreementServiceInstance = Pick<
  ReturnType<typeof AgreementService>,
  'getRegistrationAgreements' | 'getRegistrationAgreementVersions'
>;
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

      const submittedVersions = await agreementVersionRepository.getRegistrationCandidatesByIds(agreementVersionIds);

      if (submittedVersions.length !== agreementVersionIds.length) {
        throwInvalidAgreementSet({
          reason: 'unknown submitted agreement version',
          submittedCount: agreementVersionIds.length,
          resolvedCount: submittedVersions.length,
        });
      }

      const submittedAgreementIds = new Set<string>();

      for (const version of submittedVersions) {
        if (
          !version.isCurrent ||
          (version.agreementType !== AgreementType.CONSENT && version.agreementType !== AgreementType.TOS) ||
          submittedAgreementIds.has(version.agreementId)
        ) {
          throwInvalidAgreementSet({
            reason: 'stale, non-signable, unexpected, or duplicate agreement',
            agreementVersionId: version.agreementVersionId,
          });
        }
        submittedAgreementIds.add(version.agreementId);
      }

      const expectedVersions = await getExpectedRegistrationVersions(submittedVersions);

      const submittedByAgreementId = new Map(
        submittedVersions.map((version) => [version.agreementId, version.agreementVersionId]),
      );
      const matchesExpectedSelection =
        submittedVersions.length === expectedVersions.length &&
        expectedVersions.every(
          (version) => submittedByAgreementId.get(version.agreementId) === version.agreementVersionId,
        );

      if (!matchesExpectedSelection) {
        throwInvalidAgreementSet({ reason: 'submitted versions do not match a localized registration set' });
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

    // Mutable opt-ins are persisted on the caretaker separately from versioned
    // legal agreement acceptances.
    await familyService.create({
      email: input.email,
      password: input.password,
      name: input.name,
      location: input.location,
      agreementVersionIds,
      optIns: input.optIns,
    });
  }

  async function getExpectedRegistrationVersions(
    submittedVersions: RegistrationAgreementVersion[],
  ): Promise<RegistrationAgreementVersion[]> {
    const nonDefaultLocales = new Set(
      submittedVersions.map(({ locale }) => locale).filter((locale) => locale !== DEFAULT_REGISTRATION_LOCALE),
    );
    if (nonDefaultLocales.size > 1) {
      throwInvalidAgreementSet({ reason: 'agreement versions use incompatible locales' });
    }

    const requestedLocale = [...nonDefaultLocales][0] ?? DEFAULT_REGISTRATION_LOCALE;
    return agreementService.getRegistrationAgreementVersions(requestedLocale);
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
