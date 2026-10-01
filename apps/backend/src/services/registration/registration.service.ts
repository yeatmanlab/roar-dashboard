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
import { DEFAULT_REGISTRATION_LOCALE, REGISTRATION_AGREEMENT_TYPES } from '../../constants/registration-agreements';

const INVALID_AGREEMENT_SET_REASON = {
  DUPLICATE_VERSION: 'duplicate agreement version',
  UNKNOWN_VERSION: 'unknown submitted agreement version',
  STALE_VERSION: 'stale agreement version',
  NON_SIGNABLE_TYPE: 'non-signable agreement type',
  DUPLICATE_AGREEMENT: 'multiple versions submitted for one agreement',
  INCOMPATIBLE_LOCALES: 'agreement versions use incompatible locales',
  VERSION_SET_MISMATCH: 'submitted versions do not match a localized registration set',
} as const;

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
 *
 * @param dependencies - Optional service and repository overrides
 * @returns Registration agreement read and account creation operations
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
  /**
   * Fetch the legal agreements displayed by public registration.
   *
   * @param locale - Preferred locale for agreement content
   * @returns Localized current agreements, with per-agreement en-US fallback
   * @throws {ApiError} INTERNAL_SERVER_ERROR when configuration, storage, or content fetching fails
   */
  async function getAgreements(locale: string) {
    return agreementService.getRegistrationAgreements(locale);
  }

  /**
   * Validate accepted agreements and create a family account.
   *
   * @param input - Public registration details and accepted agreement version IDs
   * @returns A promise that resolves after the account and legal acceptances are persisted
   * @throws {ApiError} UNPROCESSABLE_ENTITY when the submitted agreement set is invalid
   * @throws {ApiError} Propagates registration persistence and external-service failures
   */
  async function register(input: RegistrationServiceInput): Promise<void> {
    const { agreementVersionIds } = input;

    try {
      const uniqueVersionIds = new Set(agreementVersionIds);
      if (uniqueVersionIds.size !== agreementVersionIds.length) {
        throwInvalidAgreementSet({ reason: INVALID_AGREEMENT_SET_REASON.DUPLICATE_VERSION });
      }

      const submittedVersions = await agreementVersionRepository.getRegistrationCandidatesByIds(agreementVersionIds);

      if (submittedVersions.length !== agreementVersionIds.length) {
        throwInvalidAgreementSet({
          reason: INVALID_AGREEMENT_SET_REASON.UNKNOWN_VERSION,
          submittedCount: agreementVersionIds.length,
          resolvedCount: submittedVersions.length,
        });
      }

      const submittedAgreementIds = new Set<string>();

      for (const version of submittedVersions) {
        if (!version.isCurrent) {
          throwInvalidAgreementSet({
            reason: INVALID_AGREEMENT_SET_REASON.STALE_VERSION,
            agreementVersionId: version.agreementVersionId,
          });
        }

        if (!REGISTRATION_AGREEMENT_TYPES.some((agreementType) => agreementType === version.agreementType)) {
          throwInvalidAgreementSet({
            reason: INVALID_AGREEMENT_SET_REASON.NON_SIGNABLE_TYPE,
            agreementVersionId: version.agreementVersionId,
            agreementType: version.agreementType,
          });
        }

        if (submittedAgreementIds.has(version.agreementId)) {
          throwInvalidAgreementSet({
            reason: INVALID_AGREEMENT_SET_REASON.DUPLICATE_AGREEMENT,
            agreementId: version.agreementId,
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
        throwInvalidAgreementSet({ reason: INVALID_AGREEMENT_SET_REASON.VERSION_SET_MISMATCH });
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const context = { agreementVersionCount: agreementVersionIds.length };
      logger.error({ err: error, context }, 'Failed to validate registration agreements');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context,
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

  /**
   * Resolve the exact localized agreement set expected for submitted versions.
   *
   * @param submittedVersions - Resolved submitted agreement versions
   * @returns Current versions for the inferred requested locale
   * @throws {ApiError} When submitted versions mix incompatible locales
   */
  async function getExpectedRegistrationVersions(
    submittedVersions: RegistrationAgreementVersion[],
  ): Promise<RegistrationAgreementVersion[]> {
    const nonDefaultLocales = new Set(
      submittedVersions.map(({ locale }) => locale).filter((locale) => locale !== DEFAULT_REGISTRATION_LOCALE),
    );
    if (nonDefaultLocales.size > 1) {
      throwInvalidAgreementSet({ reason: INVALID_AGREEMENT_SET_REASON.INCOMPATIBLE_LOCALES });
    }

    const requestedLocale = [...nonDefaultLocales][0] ?? DEFAULT_REGISTRATION_LOCALE;
    return agreementService.getRegistrationAgreementVersions(requestedLocale);
  }

  /**
   * Log and throw the standard invalid-agreement response.
   *
   * @param context - Non-sensitive rejection reason and relevant ids/counts
   * @returns Never returns
   * @throws {ApiError} Always throws an UNPROCESSABLE_ENTITY error
   */
  function throwInvalidAgreementSet(context: Record<string, unknown>): never {
    logger.warn({ context }, 'Rejected registration agreement set');
    throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      context,
    });
  }

  return { getAgreements, register };
}
