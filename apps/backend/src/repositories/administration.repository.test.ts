/**
 * Unit tests for AdministrationRepository.
 *
 * Tests the createWithAssignments method with transaction logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationRepository } from './administration.repository';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { faker } from '@faker-js/faker';

// Mock the database client
vi.mock('../db/clients', () => ({
  CoreDbClient: {
    transaction: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

// Mock the schema
vi.mock('../db/schema/core', () => ({
  administrations: {
    insert: vi.fn(),
  },
  administrationOrgs: {
    insert: vi.fn(),
  },
  administrationClasses: {
    insert: vi.fn(),
  },
  administrationGroups: {
    insert: vi.fn(),
  },
  administrationTaskVariants: {
    insert: vi.fn(),
    orderIndex: 'orderIndex',
  },
  administrationAgreements: {
    insert: vi.fn(),
  },
  orgs: {
    name: 'name',
  },
  classes: {
    name: 'name',
  },
  groups: {
    name: 'name',
  },
  taskVariants: {
    name: 'name',
  },
  agreements: {
    name: 'name',
    agreementType: 'agreementType',
    createdAt: 'createdAt',
  },
}));

// Mock transaction type for testing
interface MockTransaction {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
}

// Mock database type for testing
interface MockDb {
  transaction: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
}

describe('AdministrationRepository', () => {
  let repository: AdministrationRepository;
  let mockDb: MockDb;
  let mockTx: MockTransaction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      transaction: vi.fn().mockImplementation((fn) => fn(mockTx)),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    // @ts-expect-error - Using mock db for testing
    repository = new AdministrationRepository(mockDb);
  });

  describe('createWithAssignments', () => {
    it('creates administration with all related entities in a transaction', async () => {
      // Arrange
      const mockAdministration = AdministrationFactory.build();
      const input = {
        administration: {
          name: mockAdministration.name,
          namePublic: mockAdministration.namePublic,
          description: mockAdministration.description,
          dateStart: mockAdministration.dateStart,
          dateEnd: mockAdministration.dateEnd,
          isOrdered: mockAdministration.isOrdered,
          createdBy: mockAdministration.createdBy,
        },
        orgIds: [faker.string.uuid(), faker.string.uuid()],
        classIds: [faker.string.uuid()],
        groupIds: [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()],
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 1,
            conditionsAssignment: { test: 'condition' },
            conditionsRequirements: null,
          },
        ],
        agreementIds: [faker.string.uuid()],
      };

      // Mock the administration insert returning
      mockTx.returning.mockResolvedValueOnce([{ ...mockAdministration, id: mockAdministration.id }]);

      // Mock other inserts (they don't need to return anything for junction tables)
      mockTx.insert.mockReturnThis();
      mockTx.values.mockReturnThis();

      // Act
      const result = await repository.createWithAssignments(input);

      // Assert
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(6); // administrations + 5 junction tables

      // Check the calls were made correctly (the exact structure depends on mock implementation)
      expect(mockTx.insert).toHaveBeenCalledTimes(6);

      // Verify the transaction was called with our function
      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));

      expect(result).toEqual(mockAdministration);
    });

    it('skips inserts for empty arrays', async () => {
      // Arrange
      const mockAdministration = AdministrationFactory.build();
      const input = {
        administration: {
          name: mockAdministration.name,
          namePublic: mockAdministration.namePublic,
          description: mockAdministration.description,
          dateStart: mockAdministration.dateStart,
          dateEnd: mockAdministration.dateEnd,
          isOrdered: mockAdministration.isOrdered,
          createdBy: mockAdministration.createdBy,
        },
        orgIds: [],
        classIds: [],
        groupIds: [],
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        ],
        agreementIds: [],
      };

      mockTx.returning.mockResolvedValueOnce([{ ...mockAdministration, id: mockAdministration.id }]);
      mockTx.insert.mockReturnThis();
      mockTx.values.mockReturnThis();

      // Act
      await repository.createWithAssignments(input);

      // Assert
      expect(mockTx.insert).toHaveBeenCalledTimes(2); // administrations + administrationTaskVariants only
    });

    it('handles task variants with conditions', async () => {
      // Arrange
      const mockAdministration = AdministrationFactory.build();
      const input = {
        administration: {
          name: mockAdministration.name,
          namePublic: mockAdministration.namePublic,
          description: mockAdministration.description,
          dateStart: mockAdministration.dateStart,
          dateEnd: mockAdministration.dateEnd,
          isOrdered: mockAdministration.isOrdered,
          createdBy: mockAdministration.createdBy,
        },
        orgIds: [],
        classIds: [],
        groupIds: [],
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: { type: 'field', field: 'grade', operator: '>=', value: 5 },
            conditionsRequirements: { type: 'composite', operator: 'and', conditions: [] },
          },
        ],
        agreementIds: [],
      };

      mockTx.returning.mockResolvedValueOnce([{ ...mockAdministration, id: mockAdministration.id }]);
      mockTx.insert.mockReturnThis();
      mockTx.values.mockReturnThis();

      // Act
      await repository.createWithAssignments(input);

      // Assert
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      // Check that task variant conditions are passed through
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            conditionsAssignment: { type: 'field', field: 'grade', operator: '>=', value: 5 },
            conditionsRequirements: { type: 'composite', operator: 'and', conditions: [] },
          }),
        ]),
      );
    });

    it('rolls back transaction on error', async () => {
      // Arrange
      const mockAdministration = AdministrationFactory.build();
      const input = {
        administration: {
          name: mockAdministration.name,
          namePublic: mockAdministration.namePublic,
          description: mockAdministration.description,
          dateStart: mockAdministration.dateStart,
          dateEnd: mockAdministration.dateEnd,
          isOrdered: mockAdministration.isOrdered,
          createdBy: mockAdministration.createdBy,
        },
        orgIds: [faker.string.uuid()],
        classIds: [],
        groupIds: [],
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        ],
        agreementIds: [],
      };

      // Mock transaction to throw an error
      mockDb.transaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(repository.createWithAssignments(input)).rejects.toThrow('Database error');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateWithAssignments', () => {
    it('updates administration fields in a transaction', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        administration: {
          name: 'Updated Name',
          description: 'Updated description',
        },
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: administrationId });
    });

    it('upserts and prunes org assignments when orgIds provided', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        orgIds: [faker.string.uuid(), faker.string.uuid()],
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.delete).toHaveBeenCalled();
      expect(mockTx.onConflictDoNothing).toHaveBeenCalled();
      expect(result).toEqual({ id: administrationId });
    });

    it('upserts and prunes task variants with additional fields', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: { field: 'grade', op: '>=', value: 3 },
            conditionsRequirements: null,
          },
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 1,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        ],
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: administrationId });
    });

    it('deletes all task variants when empty array provided', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        taskVariants: [],
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalled();
      expect(result).toEqual({ id: administrationId });
    });

    it('skips updates for undefined fields', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        administration: {
          name: 'New Name',
        },
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: administrationId });
    });

    it('rolls back transaction on error', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        administration: {
          name: 'Updated Name',
        },
      };

      mockDb.transaction.mockRejectedValue(new Error('Database error'));

      await expect(repository.updateWithAssignments(administrationId, input)).rejects.toThrow('Database error');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('handles multiple entity types in single update', async () => {
      const administrationId = faker.string.uuid();
      const input = {
        administration: {
          name: 'Updated Name',
          isOrdered: true,
        },
        orgIds: [faker.string.uuid()],
        classIds: [faker.string.uuid()],
        groupIds: [faker.string.uuid()],
        taskVariants: [
          {
            taskVariantId: faker.string.uuid(),
            orderIndex: 0,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        ],
        agreementIds: [faker.string.uuid()],
      };

      const result = await repository.updateWithAssignments(administrationId, input);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: administrationId });
    });
  });
});
