import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationService } from './authorization.service';
import { ResourceScopeType } from '../../enums/resource-scope-type.enum';

describe('AuthorizationService', () => {
  const mockGetAccessibleAdministrationIds = vi.fn();

  const mockAuthorizationRepository = {
    getAccessibleAdministrationIds: mockGetAccessibleAdministrationIds,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdministrationsScope', () => {
    it('should return unrestricted scope for admin users', async () => {
      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      const result = await service.getAdministrationsScope('user-123', 'admin');

      expect(result).toEqual({ type: ResourceScopeType.UNRESTRICTED });
      expect(mockGetAccessibleAdministrationIds).not.toHaveBeenCalled();
    });

    it('should return scoped access for educator users', async () => {
      const accessibleIds = ['admin-1', 'admin-2', 'admin-3'];
      mockGetAccessibleAdministrationIds.mockResolvedValue(accessibleIds);

      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      const result = await service.getAdministrationsScope('user-456', 'educator');

      expect(result).toEqual({ type: ResourceScopeType.SCOPED, ids: accessibleIds });
      expect(mockGetAccessibleAdministrationIds).toHaveBeenCalledWith('user-456');
    });

    it('should return scoped access for student users', async () => {
      const accessibleIds = ['admin-1'];
      mockGetAccessibleAdministrationIds.mockResolvedValue(accessibleIds);

      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      const result = await service.getAdministrationsScope('student-123', 'student');

      expect(result).toEqual({ type: ResourceScopeType.SCOPED, ids: accessibleIds });
      expect(mockGetAccessibleAdministrationIds).toHaveBeenCalledWith('student-123');
    });

    it('should return scoped access for caregiver users', async () => {
      const accessibleIds = ['admin-1', 'admin-2'];
      mockGetAccessibleAdministrationIds.mockResolvedValue(accessibleIds);

      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      const result = await service.getAdministrationsScope('caregiver-123', 'caregiver');

      expect(result).toEqual({ type: ResourceScopeType.SCOPED, ids: accessibleIds });
      expect(mockGetAccessibleAdministrationIds).toHaveBeenCalledWith('caregiver-123');
    });

    it('should return empty scoped access when user has no accessible administrations', async () => {
      mockGetAccessibleAdministrationIds.mockResolvedValue([]);

      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      const result = await service.getAdministrationsScope('user-no-access', 'educator');

      expect(result).toEqual({ type: ResourceScopeType.SCOPED, ids: [] });
      expect(mockGetAccessibleAdministrationIds).toHaveBeenCalledWith('user-no-access');
    });

    it('should propagate repository errors', async () => {
      const dbError = new Error('Database connection failed');
      mockGetAccessibleAdministrationIds.mockRejectedValue(dbError);

      const service = AuthorizationService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authorizationRepository: mockAuthorizationRepository as any,
      });

      await expect(service.getAdministrationsScope('user-123', 'educator')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
