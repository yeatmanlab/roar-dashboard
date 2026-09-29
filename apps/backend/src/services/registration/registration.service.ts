import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import { logger } from '../../logger';
import { AgreementService, REGISTRATION_AGREEMENT_TYPES } from '../agreement/agreement.service';
import { FamilyService } from '../family/family.service';
import type { CreateFamilyServiceInput } from '../family/family.service';

const DEFAULT_REGISTRATION_LOCALE = 'en-US';

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

      if (requiredAgreementIds.length === 0) {
        logger.error('No registration agreements are configured');
        throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL,
        });
      }

      if (submittedVersions.length !== agreementVersionIds.length) {
        throwInvalidAgreementSet({
          reason: 'unknown submitted agreement version',
          submittedCount: agreementVersionIds.length,
          resolvedCount: submittedVersions.length,
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

      await validateLocaleSelection(submittedVersions);
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

  async function validateLocaleSelection(
    submittedVersions: Awaited<ReturnType<AgreementVersionRepository['getRegistrationCandidatesByIds']>>,
  ): Promise<void> {
    const submittedLocales = new Set(submittedVersions.map(({ locale }) => locale));
    if (submittedLocales.size <= 1) return;

    const nonDefaultLocales = [...submittedLocales].filter((locale) => locale !== DEFAULT_REGISTRATION_LOCALE);
    if (nonDefaultLocales.length !== 1 || !submittedLocales.has(DEFAULT_REGISTRATION_LOCALE)) {
      throwInvalidAgreementSet({ reason: 'agreement versions use incompatible locales' });
    }

    const requestedLocale = nonDefaultLocales[0]!;
    const localizedVersions = await agreementVersionRepository.listCurrentForRegistration(
      requestedLocale,
      REGISTRATION_AGREEMENT_TYPES,
    );
    const localizedByAgreementId = new Map(
      localizedVersions.map((version) => [version.agreementId, version.agreementVersionId]),
    );

    const matchesLocalizedSelection = submittedVersions.every((version) => {
      const localizedVersionId = localizedByAgreementId.get(version.agreementId);
      return localizedVersionId
        ? version.agreementVersionId === localizedVersionId
        : version.locale === DEFAULT_REGISTRATION_LOCALE;
    });

    if (!matchesLocalizedSelection) {
      throwInvalidAgreementSet({ reason: 'agreement versions do not match one localized registration set' });
    }
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
