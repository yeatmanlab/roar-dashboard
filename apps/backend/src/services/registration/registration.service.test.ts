import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AgreementType } from '../../enums/agreement-type.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiError } from '../../errors/api-error';
import { createMockAgreementVersionRepository } from '../../test-support/repositories/agreement-version.repository';
import { createMockAgreementService } from '../../test-support/services/agreement.service';
import { createMockFamilyService } from '../../test-support/services/family.service';
import { RegistrationService } from './registration.service';

const CONSENT_ID = '00000000-0000-4000-8000-000000000001';
const CONSENT_VERSION_ID = '00000000-0000-4000-8000-000000000002';
const TOS_ID = '00000000-0000-4000-8000-000000000003';
const TOS_VERSION_ID = '00000000-0000-4000-8000-000000000004';
const UNKNOWN_VERSION_ID = '00000000-0000-4000-8000-000000000099';

const validInput = {
  email: 'parent@example.com',
  password: 'password123',
  name: { first: 'Pat', last: 'Parent' },
  agreementVersionIds: [CONSENT_VERSION_ID, TOS_VERSION_ID],
  optIns: { researchContact: true },
};

const registrationVersions = [
  {
    agreementId: CONSENT_ID,
    agreementVersionId: CONSENT_VERSION_ID,
    agreementType: AgreementType.CONSENT,
    name: 'Research consent',
    locale: 'en-US',
    isCurrent: true,
    githubFilename: 'consent.md',
    githubOrgRepo: 'yeatmanlab/roar-legal',
    githubCommitSha: 'consent-sha',
  },
  {
    agreementId: TOS_ID,
    agreementVersionId: TOS_VERSION_ID,
    agreementType: AgreementType.TOS,
    name: 'Terms of service',
    locale: 'en-US',
    isCurrent: true,
    githubFilename: 'tos.md',
    githubOrgRepo: 'yeatmanlab/roar-legal',
    githubCommitSha: 'tos-sha',
  },
];

describe('RegistrationService', () => {
  let mockAgreementService: ReturnType<typeof createMockAgreementService>;
  let mockFamilyService: ReturnType<typeof createMockFamilyService>;
  let mockVersionRepository: ReturnType<typeof createMockAgreementVersionRepository>;
  let service: ReturnType<typeof RegistrationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgreementService = createMockAgreementService();
    mockFamilyService = createMockFamilyService();
    mockVersionRepository = createMockAgreementVersionRepository();
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue(registrationVersions);
    mockAgreementService.getRegistrationAgreementVersions.mockResolvedValue(registrationVersions);
    mockFamilyService.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000005' });
    service = RegistrationService({
      agreementService: mockAgreementService,
      agreementVersionRepository: mockVersionRepository,
      familyService: mockFamilyService,
    });
  });

  it('delegates the public agreements read', async () => {
    mockAgreementService.getRegistrationAgreements.mockResolvedValue([]);

    await expect(service.getAgreements('es-MX')).resolves.toEqual([]);
    expect(mockAgreementService.getRegistrationAgreements).toHaveBeenCalledWith('es-MX');
  });

  it('validates all agreements before creating the family', async () => {
    await service.register(validInput);

    expect(mockVersionRepository.getRegistrationCandidatesByIds).toHaveBeenCalledWith(validInput.agreementVersionIds);
    expect(mockFamilyService.create).toHaveBeenCalledWith({
      email: validInput.email,
      password: validInput.password,
      name: validInput.name,
      location: undefined,
      agreementVersionIds: validInput.agreementVersionIds,
      optIns: validInput.optIns,
    });
    expect(mockVersionRepository.getRegistrationCandidatesByIds.mock.invocationCallOrder[0]).toBeLessThan(
      mockFamilyService.create.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects an unknown agreement version', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([]);

    await expect(service.register({ ...validInput, agreementVersionIds: [UNKNOWN_VERSION_ID] })).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      context: { reason: 'unknown submitted agreement version', submittedCount: 1, resolvedCount: 0 },
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('rejects a missing required agreement', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue(registrationVersions.slice(0, 1));

    await expect(service.register({ ...validInput, agreementVersionIds: [CONSENT_VERSION_ID] })).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      context: { reason: 'submitted versions do not match a localized registration set' },
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('returns 500 when no registration agreements are configured', async () => {
    mockAgreementService.getRegistrationAgreementVersions.mockRejectedValue(
      new ApiError('No registration agreements are configured', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { locale: 'en-US' },
      }),
    );

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.INTERNAL,
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('rejects stale agreement versions before writing', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([
      { ...registrationVersions[0]!, isCurrent: false },
      registrationVersions[1]!,
    ]);

    await expect(service.register(validInput)).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('rejects assent agreements before writing', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([
      { ...registrationVersions[0]!, agreementType: AgreementType.ASSENT },
      registrationVersions[1]!,
    ]);

    await expect(service.register(validInput)).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate agreement versions before writing', async () => {
    await expect(
      service.register({ ...validInput, agreementVersionIds: [CONSENT_VERSION_ID, CONSENT_VERSION_ID] }),
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNPROCESSABLE_ENTITY });
    expect(mockVersionRepository.getRegistrationCandidatesByIds).not.toHaveBeenCalled();
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('accepts one requested locale with an en-US fallback version', async () => {
    const localizedConsent = { ...registrationVersions[0]!, locale: 'es-MX' };
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([
      localizedConsent,
      registrationVersions[1]!,
    ]);
    mockAgreementService.getRegistrationAgreementVersions.mockResolvedValue([
      localizedConsent,
      registrationVersions[1]!,
    ]);

    await service.register(validInput);

    expect(mockAgreementService.getRegistrationAgreementVersions).toHaveBeenCalledWith('es-MX');
    expect(mockFamilyService.create).toHaveBeenCalledOnce();
  });

  it('rejects an en-US fallback when the requested locale has a current version', async () => {
    const localizedConsent = { ...registrationVersions[0]!, locale: 'es-MX' };
    const localizedTos = {
      ...registrationVersions[1]!,
      agreementVersionId: '00000000-0000-4000-8000-000000000006',
      locale: 'es-MX',
    };
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([
      localizedConsent,
      registrationVersions[1]!,
    ]);
    mockAgreementService.getRegistrationAgreementVersions.mockResolvedValue([localizedConsent, localizedTos]);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      context: { reason: 'submitted versions do not match a localized registration set' },
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('rejects agreement versions from incompatible locales', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue([
      { ...registrationVersions[0]!, locale: 'es-MX' },
      { ...registrationVersions[1]!, locale: 'fr-FR' },
    ]);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });

  it('wraps unexpected repository failures without writing', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockRejectedValue(new Error('database unavailable'));

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.DATABASE_QUERY_FAILED,
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });
});
