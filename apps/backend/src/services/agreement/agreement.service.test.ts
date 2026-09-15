import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { AgreementsListOptions } from './agreement.service';
import { AgreementService } from './agreement.service';
import { createMockAgreementRepository } from '../../test-support/repositories/agreement.repository';
import { AuthContextFactory } from '../../test-support/factories/user.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AgreementType } from '../../enums/agreement-type.enum';
import type { AgreementEmbedOptionType } from '../../enums/agreement-embed-option.enum';

describe('AgreementService', () => {
  let mockRepository: ReturnType<typeof createMockAgreementRepository>;
  let mockFetchContent: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof AgreementService>;

  const defaultOptions = {
    page: 1,
    perPage: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc' as const,
    locale: 'en-US',
    embed: [] as AgreementEmbedOptionType[],
  } as AgreementsListOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = createMockAgreementRepository();
    mockFetchContent = vi.fn();
    service = AgreementService({ agreementRepository: mockRepository, fetchContent: mockFetchContent });
  });

  describe('list', () => {
    it('calls listAll with correct query params', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      await service.list(authContext, { ...defaultOptions, agreementType: AgreementType.CONSENT });

      expect(mockRepository.listAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
        locale: 'en-US',
        agreementType: AgreementType.CONSENT,
      });
    });

    it('omits agreementType from query when not provided', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      await service.list(authContext, defaultOptions);

      expect(mockRepository.listAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ agreementType: expect.anything() }),
      );
    });

    it('returns paginated result without versions when embed is empty', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build({ agreementType: AgreementType.TOS });
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });

      mockRepository.listAll.mockResolvedValue({
        items: [{ ...agreement, currentVersion: version }],
        totalItems: 1,
      });

      const result = await service.list(authContext, defaultOptions);

      expect(result.totalItems).toBe(1);
      expect(result.items[0]).not.toHaveProperty('versions');
      expect(mockRepository.getVersionsByAgreementIds).not.toHaveBeenCalled();
    });

    it('resolves versions embed by calling getVersionsByAgreementIds', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build({ agreementType: AgreementType.CONSENT });
      const currentVersion = AgreementVersionFactory.build({ agreementId: agreement.id, isCurrent: true });
      const historicalVersion = AgreementVersionFactory.build({ agreementId: agreement.id, isCurrent: false });

      mockRepository.listAll.mockResolvedValue({
        items: [{ ...agreement, currentVersion }],
        totalItems: 1,
      });
      mockRepository.getVersionsByAgreementIds.mockResolvedValue(
        new Map([[agreement.id, [currentVersion, historicalVersion]]]),
      );

      const result = await service.list(authContext, { ...defaultOptions, embed: ['versions'] });

      expect(mockRepository.getVersionsByAgreementIds).toHaveBeenCalledWith([agreement.id]);
      expect(result.items[0]!.versions).toHaveLength(2);
    });

    it('attaches empty array when agreement has no versions in the map', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build({ agreementType: AgreementType.ASSENT });
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });

      mockRepository.listAll.mockResolvedValue({
        items: [{ ...agreement, currentVersion: version }],
        totalItems: 1,
      });
      // Map does not contain this agreement's id
      mockRepository.getVersionsByAgreementIds.mockResolvedValue(new Map());

      const result = await service.list(authContext, { ...defaultOptions, embed: ['versions'] });

      expect(result.items[0]!.versions).toEqual([]);
    });

    it('skips getVersionsByAgreementIds when result is empty', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      await service.list(authContext, { ...defaultOptions, embed: ['versions'] });

      expect(mockRepository.getVersionsByAgreementIds).not.toHaveBeenCalled();
    });

    it('re-throws ApiError from repository without wrapping', async () => {
      const authContext = AuthContextFactory.build();
      const apiError = new ApiError('Not found', { statusCode: 404, code: ApiErrorCode.RESOURCE_NOT_FOUND });
      mockRepository.listAll.mockRejectedValue(apiError);

      await expect(service.list(authContext, defaultOptions)).rejects.toThrow(apiError);
    });

    it('wraps unexpected errors in ApiError with 500/DATABASE_QUERY_FAILED', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.listAll.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.list(authContext, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('getVersionContent', () => {
    it('returns version content when agreement and version exist', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build();
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });
      const markdownContent = '# Terms of Service\n\nBy using ROAR, you agree to...';

      mockRepository.getById.mockResolvedValue(agreement);
      mockRepository.getVersionByIdForAgreement.mockResolvedValue(version);
      mockFetchContent.mockResolvedValue(markdownContent);

      const result = await service.getVersionContent(authContext, agreement.id, version.id);

      expect(result.id).toBe(version.id);
      expect(result.agreementId).toBe(agreement.id);
      expect(result.locale).toBe(version.locale);
      expect(result.content).toBe(markdownContent);
      expect(result.githubCommitSha).toBe(version.githubCommitSha);
      expect(mockFetchContent).toHaveBeenCalledWith(
        version.githubOrgRepo,
        version.githubCommitSha,
        version.githubFilename,
      );
    });

    it('throws 404 when agreement does not exist', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.getById.mockResolvedValue(null);

      await expect(service.getVersionContent(authContext, 'missing-id', 'version-id')).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRepository.getVersionByIdForAgreement).not.toHaveBeenCalled();
    });

    it('throws 404 when version does not exist or belongs to different agreement', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build();

      mockRepository.getById.mockResolvedValue(agreement);
      mockRepository.getVersionByIdForAgreement.mockResolvedValue(null);

      await expect(service.getVersionContent(authContext, agreement.id, 'missing-version')).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('re-throws ApiError from fetchContent without wrapping (e.g., non-200 GitHub response)', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build();
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });
      const fetchError = new ApiError('Failed to fetch agreement content', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
      });

      mockRepository.getById.mockResolvedValue(agreement);
      mockRepository.getVersionByIdForAgreement.mockResolvedValue(version);
      mockFetchContent.mockRejectedValue(fetchError);

      await expect(service.getVersionContent(authContext, agreement.id, version.id)).rejects.toThrow(fetchError);
    });

    it('re-throws ApiError from fetchContent when content is empty', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build();
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });
      const emptyContentError = new ApiError('Agreement content is empty', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
      });

      mockRepository.getById.mockResolvedValue(agreement);
      mockRepository.getVersionByIdForAgreement.mockResolvedValue(version);
      mockFetchContent.mockRejectedValue(emptyContentError);

      await expect(service.getVersionContent(authContext, agreement.id, version.id)).rejects.toThrow(emptyContentError);
    });

    it('wraps unexpected errors in ApiError with 500/EXTERNAL_SERVICE_FAILED (e.g., timeout)', async () => {
      const authContext = AuthContextFactory.build();
      const agreement = AgreementFactory.build();
      const version = AgreementVersionFactory.build({ agreementId: agreement.id });

      mockRepository.getById.mockResolvedValue(agreement);
      mockRepository.getVersionByIdForAgreement.mockResolvedValue(version);
      mockFetchContent.mockRejectedValue(new Error('Network timeout'));

      await expect(service.getVersionContent(authContext, agreement.id, version.id)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
      });
    });
  });
});
