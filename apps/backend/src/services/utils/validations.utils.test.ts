import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { verifyEntitiesExist } from './validations.utils';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors';

describe('verifyEntitiesExist', () => {
  it('should not throw when all entity IDs exist', () => {
    const allEntities = [{ id: 'id-1' }, { id: 'id-2' }, { id: 'id-3' }];
    const entityIdsToCheck = ['id-1', 'id-2'];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).not.toThrow();
  });

  it('should not throw when entityIdsToCheck is empty', () => {
    const allEntities = [{ id: 'id-1' }, { id: 'id-2' }];
    const entityIdsToCheck: string[] = [];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).not.toThrow();
  });

  it('should not throw when both arrays are empty', () => {
    const allEntities: { id: string }[] = [];
    const entityIdsToCheck: string[] = [];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).not.toThrow();
  });

  it('should throw ApiError when some entity IDs are missing', () => {
    const allEntities = [{ id: 'id-1' }, { id: 'id-2' }];
    const entityIdsToCheck = ['id-1', 'id-3', 'id-4'];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).toThrow(ApiError);

    try {
      verifyEntitiesExist(allEntities, entityIdsToCheck);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.message).toBe(ApiErrorMessage.UNPROCESSABLE_ENTITY);
      expect(apiError.statusCode).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(apiError.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
      expect(apiError.context).toEqual({ entityIds: ['id-3', 'id-4'] });
    }
  });

  it('should throw ApiError when all entity IDs are missing', () => {
    const allEntities = [{ id: 'id-1' }, { id: 'id-2' }];
    const entityIdsToCheck = ['id-3', 'id-4'];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).toThrow(ApiError);

    try {
      verifyEntitiesExist(allEntities, entityIdsToCheck);
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.context).toEqual({ entityIds: ['id-3', 'id-4'] });
    }
  });

  it('should throw ApiError when allEntities is empty but entityIdsToCheck has values', () => {
    const allEntities: { id: string }[] = [];
    const entityIdsToCheck = ['id-1', 'id-2'];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).toThrow(ApiError);

    try {
      verifyEntitiesExist(allEntities, entityIdsToCheck);
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.context).toEqual({ entityIds: ['id-1', 'id-2'] });
    }
  });

  it('should work with entities that have additional properties', () => {
    const allEntities = [
      { id: 'id-1', name: 'Entity 1', extra: true },
      { id: 'id-2', name: 'Entity 2', extra: false },
    ];
    const entityIdsToCheck = ['id-1', 'id-2'];

    expect(() => verifyEntitiesExist(allEntities, entityIdsToCheck)).not.toThrow();
  });
});
