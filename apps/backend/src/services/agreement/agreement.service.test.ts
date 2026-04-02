import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgreementService, AgreementsListOptions } from './agreement.service';
import { createMockAgreementRepository } from '../../test-support/repositories/agreement.repository';
import { AuthContextFactory } from '../../test-support/factories/user.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AgreementType } from '../../enums/agreement-type.enum';
import type { AgreementEmbedOptionType } from './agreement.service';

describe('AgreementService', () => {
  let mockRepository: ReturnType<typeof createMockAgreementRepository>;
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
    service = AgreementService({ agreementRepository: mockRepository });
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

    it('wraps unexpected errors in ApiError', async () => {
      const authContext = AuthContextFactory.build();
      mockRepository.listAll.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.list(authContext, defaultOptions)).rejects.toBeInstanceOf(ApiError);
    });
  });
});
