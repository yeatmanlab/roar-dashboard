import { describe, it, expect } from 'vitest';
import { transformAdministrationBase, transformAdministration } from './administration.transform';
import {
  AdministrationFactory,
  AdministrationWithEmbedsFactory,
} from '../../test-support/factories/administration.factory';

describe('administration.transform', () => {
  describe('transformAdministrationBase', () => {
    it('maps all required fields correctly', () => {
      const admin = AdministrationFactory.build({
        id: 'test-admin-id',
        name: 'Internal Administration Name',
        namePublic: 'Public Administration Name',
        dateStart: new Date('2024-01-01T00:00:00.000Z'),
        dateEnd: new Date('2024-12-31T23:59:59.999Z'),
        createdAt: new Date('2023-12-01T10:00:00.000Z'),
        isOrdered: true,
      });

      const result = transformAdministrationBase(admin);

      expect(result.id).toBe('test-admin-id');
      expect(result.name).toBe('Internal Administration Name');
      expect(result.publicName).toBe('Public Administration Name');
      expect(result.isOrdered).toBe(true);
    });

    it('converts Date fields to ISO strings', () => {
      const admin = AdministrationFactory.build({
        dateStart: new Date('2024-01-01T00:00:00.000Z'),
        dateEnd: new Date('2024-12-31T23:59:59.999Z'),
        createdAt: new Date('2023-12-01T10:00:00.000Z'),
      });

      const result = transformAdministrationBase(admin);

      expect(result.dates.start).toBe('2024-01-01T00:00:00.000Z');
      expect(result.dates.end).toBe('2024-12-31T23:59:59.999Z');
      expect(result.dates.created).toBe('2023-12-01T10:00:00.000Z');
    });

    it('renames namePublic to publicName', () => {
      const admin = AdministrationFactory.build({
        namePublic: 'Test Public Name',
      });

      const result = transformAdministrationBase(admin);

      expect(result.publicName).toBe('Test Public Name');
      expect(result).not.toHaveProperty('namePublic');
    });

    it('handles isOrdered as false', () => {
      const admin = AdministrationFactory.build({
        isOrdered: false,
      });

      const result = transformAdministrationBase(admin);

      expect(result.isOrdered).toBe(false);
    });

    it('omits internal fields from response', () => {
      const admin = AdministrationFactory.build({
        description: 'Internal description',
        excludedFromResearch: null,
        excludedFromResearchBy: null,
        excludedFromResearchReason: null,
        createdBy: 'user-id',
        updatedAt: new Date(),
      });

      const result = transformAdministrationBase(admin);

      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('excludedFromResearch');
      expect(result).not.toHaveProperty('excludedFromResearchBy');
      expect(result).not.toHaveProperty('excludedFromResearchReason');
      expect(result).not.toHaveProperty('createdBy');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('preserves milliseconds in ISO string conversion', () => {
      const admin = AdministrationFactory.build({
        dateStart: new Date('2024-01-01T12:34:56.789Z'),
        dateEnd: new Date('2024-12-31T23:59:59.123Z'),
        createdAt: new Date('2023-12-01T10:20:30.456Z'),
      });

      const result = transformAdministrationBase(admin);

      expect(result.dates.start).toBe('2024-01-01T12:34:56.789Z');
      expect(result.dates.end).toBe('2024-12-31T23:59:59.123Z');
      expect(result.dates.created).toBe('2023-12-01T10:20:30.456Z');
    });
  });

  describe('transformAdministration', () => {
    it('returns base administration when no embeds are present', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        id: 'test-id',
        name: 'Test Admin',
        namePublic: 'Test Public',
        dateStart: new Date('2024-01-01T00:00:00.000Z'),
        dateEnd: new Date('2024-12-31T23:59:59.999Z'),
        createdAt: new Date('2023-12-01T10:00:00.000Z'),
        isOrdered: false,
      });

      const result = transformAdministration(admin);

      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Test Admin');
      expect(result.publicName).toBe('Test Public');
      expect(result.isOrdered).toBe(false);
      expect(result).not.toHaveProperty('stats');
      expect(result).not.toHaveProperty('tasks');
    });

    it('includes stats when embedded', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        stats: {
          assigned: 100,
          started: 75,
          completed: 50,
        },
      });

      const result = transformAdministration(admin);

      expect(result.stats).toEqual({
        assigned: 100,
        started: 75,
        completed: 50,
      });
    });

    it('includes tasks when embedded', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        tasks: [
          {
            taskId: 'task-1',
            taskName: 'Task One',
            variantId: 'variant-1',
            variantName: 'Variant One',
            orderIndex: 0,
          },
          {
            taskId: 'task-2',
            taskName: 'Task Two',
            variantId: 'variant-2',
            variantName: null,
            orderIndex: 1,
          },
        ],
      });

      const result = transformAdministration(admin);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks![0]).toEqual({
        taskId: 'task-1',
        taskName: 'Task One',
        variantId: 'variant-1',
        variantName: 'Variant One',
        orderIndex: 0,
      });
      expect(result.tasks![1]).toEqual({
        taskId: 'task-2',
        taskName: 'Task Two',
        variantId: 'variant-2',
        variantName: null,
        orderIndex: 1,
      });
    });

    it('includes both stats and tasks when both are embedded', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        stats: {
          assigned: 50,
          started: 30,
          completed: 20,
        },
        tasks: [
          {
            taskId: 'task-1',
            taskName: 'Task One',
            variantId: 'variant-1',
            variantName: 'Variant One',
            orderIndex: 0,
          },
        ],
      });

      const result = transformAdministration(admin);

      expect(result.stats).toEqual({
        assigned: 50,
        started: 30,
        completed: 20,
      });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks![0]!.taskId).toBe('task-1');
    });

    it('handles stats with zero values', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        stats: {
          assigned: 0,
          started: 0,
          completed: 0,
        },
      });

      const result = transformAdministration(admin);

      expect(result.stats).toEqual({
        assigned: 0,
        started: 0,
        completed: 0,
      });
    });

    it('handles empty tasks array', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        tasks: [],
      });

      const result = transformAdministration(admin);

      expect(result.tasks).toEqual([]);
    });

    it('preserves task order by orderIndex', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        tasks: [
          {
            taskId: 'task-3',
            taskName: 'Task Three',
            variantId: 'variant-3',
            variantName: 'Variant Three',
            orderIndex: 2,
          },
          {
            taskId: 'task-1',
            taskName: 'Task One',
            variantId: 'variant-1',
            variantName: 'Variant One',
            orderIndex: 0,
          },
          {
            taskId: 'task-2',
            taskName: 'Task Two',
            variantId: 'variant-2',
            variantName: 'Variant Two',
            orderIndex: 1,
          },
        ],
      });

      const result = transformAdministration(admin);

      expect(result.tasks![0]!.orderIndex).toBe(2);
      expect(result.tasks![1]!.orderIndex).toBe(0);
      expect(result.tasks![2]!.orderIndex).toBe(1);
    });

    it('handles tasks with null variantName', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        tasks: [
          {
            taskId: 'task-1',
            taskName: 'Task One',
            variantId: 'variant-1',
            variantName: null,
            orderIndex: 0,
          },
        ],
      });

      const result = transformAdministration(admin);

      expect(result.tasks![0]!.variantName).toBeNull();
    });

    it('maintains base administration structure with embeds', () => {
      const admin = AdministrationWithEmbedsFactory.build({
        id: 'embed-test-id',
        name: 'Embed Test Admin',
        namePublic: 'Embed Test Public',
        dateStart: new Date('2024-06-01T00:00:00.000Z'),
        dateEnd: new Date('2024-06-30T23:59:59.999Z'),
        createdAt: new Date('2024-05-01T10:00:00.000Z'),
        isOrdered: true,
        stats: {
          assigned: 10,
          started: 5,
          completed: 2,
        },
      });

      const result = transformAdministration(admin);

      expect(result.id).toBe('embed-test-id');
      expect(result.name).toBe('Embed Test Admin');
      expect(result.publicName).toBe('Embed Test Public');
      expect(result.dates.start).toBe('2024-06-01T00:00:00.000Z');
      expect(result.dates.end).toBe('2024-06-30T23:59:59.999Z');
      expect(result.dates.created).toBe('2024-05-01T10:00:00.000Z');
      expect(result.isOrdered).toBe(true);
      expect(result.stats).toBeDefined();
    });
  });
});
