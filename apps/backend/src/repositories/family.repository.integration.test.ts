/**
 * Integration tests for FamilyRepository.
 *
 * Tests custom methods (getById, getUsersByFamilyId) against the
 * real database. Families have a flat structure with no hierarchy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { FamilyRepository } from './family.repository';
import { CoreDbClient } from '../test-support/db';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import { UserFactory } from '../test-support/factories/user.factory';

describe('FamilyRepository', () => {
  let repository: FamilyRepository;

  beforeAll(() => {
    repository = new FamilyRepository(CoreDbClient);
  });

  describe('getById (inherited)', () => {
    it('returns family when it exists', async () => {
      const family = await FamilyFactory.create();

      const result = await repository.getById({ id: family.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(family.id);
    });

    it('returns null for nonexistent family', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });

  describe('getUsersByFamilyId', () => {
    it('returns all enrolled users for a family', async () => {
      const family = await FamilyFactory.create();
      const parent = await UserFactory.create({ nameLast: 'Parent', dob: '1985-01-01' });
      const child = await UserFactory.create({ nameLast: 'Child', dob: '2015-01-01', grade: '3' });

      await UserFamilyFactory.create({
        userId: parent.id,
        familyId: family.id,
        role: 'parent',
      });

      await UserFamilyFactory.create({
        userId: child.id,
        familyId: family.id,
        role: 'child',
      });

      const result = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);

      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(parent.id);
      expect(userIds).toContain(child.id);
    });

    it('returns roles array for each user', async () => {
      const family = await FamilyFactory.create();
      const parent = await UserFactory.create({ nameLast: 'Parent', dob: '1985-01-01' });

      await UserFamilyFactory.create({
        userId: parent.id,
        familyId: family.id,
        role: 'parent',
      });

      const result = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(parent.id);
      expect(result.items[0]!.roles).toEqual(['parent']);
    });

    it('returns empty for family with no enrolled users', async () => {
      const emptyFamily = await FamilyFactory.create();

      const result = await repository.getUsersByFamilyId(emptyFamily.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('respects pagination', async () => {
      const family = await FamilyFactory.create();
      const parent = await UserFactory.create({ nameLast: 'Parent' });
      const child1 = await UserFactory.create({ nameLast: 'Child1' });
      const child2 = await UserFactory.create({ nameLast: 'Child2' });

      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child1.id, familyId: family.id, role: 'child' });
      await UserFamilyFactory.create({ userId: child2.id, familyId: family.id, role: 'child' });

      const page1 = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 2,
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.totalItems).toBe(3);

      const page2 = await repository.getUsersByFamilyId(family.id, {
        page: 2,
        perPage: 2,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.totalItems).toBe(3);

      // Pages should have different users
      const page1Ids = page1.items.map((u) => u.id);
      const page2Ids = page2.items.map((u) => u.id);
      expect(page1Ids).not.toContain(page2Ids[0]);
    });

    it('applies default sorting by nameLast ascending when no orderBy specified', async () => {
      const family = await FamilyFactory.create();
      const userZ = await UserFactory.create({ nameLast: 'Zulu' });
      const userA = await UserFactory.create({ nameLast: 'Alpha' });
      const userM = await UserFactory.create({ nameLast: 'Mike' });

      await UserFamilyFactory.create({ userId: userZ.id, familyId: family.id, role: 'child' });
      await UserFamilyFactory.create({ userId: userA.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: userM.id, familyId: family.id, role: 'child' });

      const result = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.nameLast).toBe('Alpha');
      expect(result.items[1]!.nameLast).toBe('Mike');
      expect(result.items[2]!.nameLast).toBe('Zulu');
    });

    it('applies sorting by username descending', async () => {
      const family = await FamilyFactory.create();
      const userA = await UserFactory.create({ username: 'aaa_user' });
      const userZ = await UserFactory.create({ username: 'zzz_user' });
      const userM = await UserFactory.create({ username: 'mmm_user' });

      await UserFamilyFactory.create({ userId: userA.id, familyId: family.id, role: 'child' });
      await UserFamilyFactory.create({ userId: userZ.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: userM.id, familyId: family.id, role: 'child' });

      const result = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'username', direction: SortOrder.DESC },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_user');
      expect(result.items[1]!.username).toBe('mmm_user');
      expect(result.items[2]!.username).toBe('aaa_user');
    });

    it('excludes users with expired family membership', async () => {
      const family = await FamilyFactory.create();
      const activeParent = await UserFactory.create({ nameLast: 'ActiveParent' });
      const expiredChild = await UserFactory.create({ nameLast: 'ExpiredChild' });

      await UserFamilyFactory.create({
        userId: activeParent.id,
        familyId: family.id,
        role: 'parent',
      });

      await UserFamilyFactory.create({
        userId: expiredChild.id,
        familyId: family.id,
        role: 'child',
        joinedOn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        leftOn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      const result = await repository.getUsersByFamilyId(family.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1); // Only active users
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(activeParent.id);
      expect(userIds).not.toContain(expiredChild.id);
    });

    it('excludes families with rostering ended', async () => {
      const endedFamily = await FamilyFactory.create({
        rosteringEnded: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });
      const parent = await UserFactory.create({ nameLast: 'Parent' });

      await UserFamilyFactory.create({
        userId: parent.id,
        familyId: endedFamily.id,
        role: 'parent',
      });

      const result = await repository.getUsersByFamilyId(endedFamily.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns empty for nonexistent family ID', async () => {
      const result = await repository.getUsersByFamilyId('00000000-0000-0000-0000-000000000000', {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    describe('filters', () => {
      it('filters by role (parent)', async () => {
        const family = await FamilyFactory.create();
        const parent1 = await UserFactory.create({ nameLast: 'Parent1' });
        const parent2 = await UserFactory.create({ nameLast: 'Parent2' });
        const child = await UserFactory.create({ nameLast: 'Child' });

        await UserFamilyFactory.create({ userId: parent1.id, familyId: family.id, role: 'parent' });
        await UserFamilyFactory.create({ userId: parent2.id, familyId: family.id, role: 'parent' });
        await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

        const result = await repository.getUsersByFamilyId(family.id, {
          page: 1,
          perPage: 100,
          role: 'parent',
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(parent1.id);
        expect(userIds).toContain(parent2.id);
        expect(userIds).not.toContain(child.id);

        // Verify all returned users have the filtered role
        for (const user of result.items) {
          expect(user.roles).toEqual(['parent']);
        }
      });

      it('filters by role (child)', async () => {
        const family = await FamilyFactory.create();
        const parent = await UserFactory.create({ nameLast: 'Parent' });
        const child1 = await UserFactory.create({ nameLast: 'Child1' });
        const child2 = await UserFactory.create({ nameLast: 'Child2' });

        await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
        await UserFamilyFactory.create({ userId: child1.id, familyId: family.id, role: 'child' });
        await UserFamilyFactory.create({ userId: child2.id, familyId: family.id, role: 'child' });

        const result = await repository.getUsersByFamilyId(family.id, {
          page: 1,
          perPage: 100,
          role: 'child',
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(child1.id);
        expect(userIds).toContain(child2.id);
        expect(userIds).not.toContain(parent.id);

        // Verify all returned users have the filtered role
        for (const user of result.items) {
          expect(user.roles).toEqual(['child']);
        }
      });

      it('filters by grade', async () => {
        const family = await FamilyFactory.create();
        const child3 = await UserFactory.create({ nameLast: 'Grade3Child', grade: '3' });
        const child5a = await UserFactory.create({ nameLast: 'Grade5ChildA', grade: '5' });
        const child5b = await UserFactory.create({ nameLast: 'Grade5ChildB', grade: '5' });

        await UserFamilyFactory.create({ userId: child3.id, familyId: family.id, role: 'child' });
        await UserFamilyFactory.create({ userId: child5a.id, familyId: family.id, role: 'child' });
        await UserFamilyFactory.create({ userId: child5b.id, familyId: family.id, role: 'child' });

        const result = await repository.getUsersByFamilyId(family.id, {
          page: 1,
          perPage: 100,
          grade: ['5'],
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(child5a.id);
        expect(userIds).toContain(child5b.id);
        expect(userIds).not.toContain(child3.id);
      });

      it('filters by both role and grade', async () => {
        const family = await FamilyFactory.create();
        const parent = await UserFactory.create({ nameLast: 'Parent', grade: '5' });
        const child3 = await UserFactory.create({ nameLast: 'Grade3Child', grade: '3' });
        const child5 = await UserFactory.create({ nameLast: 'Grade5Child', grade: '5' });

        await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
        await UserFamilyFactory.create({ userId: child3.id, familyId: family.id, role: 'child' });
        await UserFamilyFactory.create({ userId: child5.id, familyId: family.id, role: 'child' });

        const result = await repository.getUsersByFamilyId(family.id, {
          page: 1,
          perPage: 100,
          role: 'child',
          grade: ['5'],
        });

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(child5.id);
      });

      it('returns empty when no users match filter', async () => {
        const family = await FamilyFactory.create();
        const child = await UserFactory.create({ nameLast: 'OnlyChild' });

        await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

        const result = await repository.getUsersByFamilyId(family.id, {
          page: 1,
          perPage: 100,
          role: 'parent',
        });

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });
});
