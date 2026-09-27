import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AgreementType } from '../../enums/agreement-type.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { createMockAgreementVersionRepository } from '../../test-support/repositories/agreement-version.repository';
import { RegistrationService } from './registration.service';

const CONSENT_ID = '00000000-0000-4000-8000-000000000001';
const CONSENT_VERSION_ID = '00000000-0000-4000-8000-000000000002';
const TOS_ID = '00000000-0000-4000-8000-000000000003';
const TOS_VERSION_ID = '00000000-0000-4000-8000-000000000004';

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
  const mockAgreementService = { getRegistrationAgreements: vi.fn() };
  const mockFamilyService = { create: vi.fn() };
  let mockVersionRepository: ReturnType<typeof createMockAgreementVersionRepository>;
  let service: ReturnType<typeof RegistrationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVersionRepository = createMockAgreementVersionRepository();
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue(registrationVersions);
    mockVersionRepository.listRequiredRegistrationAgreementIds.mockResolvedValue([CONSENT_ID, TOS_ID]);
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
    });
    expect(mockVersionRepository.getRegistrationCandidatesByIds.mock.invocationCallOrder[0]).toBeLessThan(
      mockFamilyService.create.mock.invocationCallOrder[0]!,
    );
  });

  it.each([
    ['unknown version', registrationVersions.slice(0, 1), [CONSENT_ID, TOS_ID]],
    ['missing required agreement', registrationVersions.slice(0, 1), [CONSENT_ID, TOS_ID]],
    ['no configured agreements', registrationVersions, []],
  ])('rejects an invalid agreement set: %s', async (_label, submitted, required) => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockResolvedValue(submitted);
    mockVersionRepository.listRequiredRegistrationAgreementIds.mockResolvedValue(required);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
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

  it('wraps unexpected repository failures without writing', async () => {
    mockVersionRepository.getRegistrationCandidatesByIds.mockRejectedValue(new Error('database unavailable'));

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.DATABASE_QUERY_FAILED,
    });
    expect(mockFamilyService.create).not.toHaveBeenCalled();
  });
});
