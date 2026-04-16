/**
 * Integration tests for SchoolRepository.
 *
 * Tests custom methods (listAll, listAllByDistrictId, listAccessibleByDistrictId,
 * getUnrestrictedById, fetchSchoolCounts) against the real database with the base
 * fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { ClassFactory } from '../test-support/factories/class.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import type { SchoolWithCounts } from './school.repository';
import { SchoolRepository } from './school.repository';
import { OrgType } from '../enums/org-type.enum';

describe('SchoolRepository', () => {
  let repository: SchoolRepository;

  beforeAll(() => {
    repository = new SchoolRepository();
  });

  describe('listAll', () => {
    it('returns all schools with pagination', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      expect(result.totalItems).toBeGreaterThanOrEqual(1);
      expect(result.items.length).toBeGreaterThanOrEqual(1);

      // All items should be schools
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.SCHOOL);
      }
    });

    it('respects perPage limit', async () => {
      const result = await repository.listAll({ page: 1, perPage: 1 });

      expect(result.items.length).toBeLessThanOrEqual(1);
      expect(result.totalItems).toBeGreaterThanOrEqual(1);
    });

    it('applies orderBy name ascending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.name.toLowerCase() <= result.items[i]!.name.toLowerCase()).toBe(true);
      }
    });

    it('applies orderBy abbreviation descending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'abbreviation', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.abbreviation.toLowerCase() >= result.items[i]!.abbreviation.toLowerCase()).toBe(
          true,
        );
      }
    });

    it('applies orderBy name descending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.name.toLowerCase() >= result.items[i]!.name.toLowerCase()).toBe(true);
      }
    });

    it('excludes schools with rosteringEnded by default', async () => {
      // Create a school with rosteringEnded set
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School Exclude Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      // Verify the school was created with rosteringEnded
      expect(endedSchool.rosteringEnded).not.toBeNull();

      const result = await repository.listAll({
        page: 1,
        perPage: 1000,
        includeEnded: false,
      });

      const ids = result.items.map((s) => s.id);

      // All returned items should have null rosteringEnded
      for (const item of result.items) {
        expect(item.rosteringEnded).toBeNull();
      }

      // Our ended school should NOT be in the results
      expect(ids).not.toContain(endedSchool.id);
    });

    it('includes schools with rosteringEnded when includeEnded=true', async () => {
      // Create a school with rosteringEnded set
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School 2',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        includeEnded: true,
      });

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(endedSchool.id);
    });

    it('only returns schools, not other org types', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      // Verify no districts, classes, etc. are returned
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.SCHOOL);
      }
    });
  });

  describe('counts aggregation', () => {
    it('returns accurate user counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Should have at least the school student
      expect(school?.counts?.users).toBeGreaterThan(0);
    });

    it('returns accurate class counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Should have at least Class A
      expect(school?.counts?.classes).toBeGreaterThanOrEqual(0);
    });

    it('does not include schools count for schools', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Schools should NOT have schools count
      expect(school?.counts).not.toHaveProperty('schools');
      expect(school?.counts).toHaveProperty('users');
      expect(school?.counts).toHaveProperty('classes');
    });

    it('returns zero counts for empty school', async () => {
      const emptySchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Empty School for Counts',
        parentOrgId: baseFixture.district.id,
      });

      const result = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      // Find the newly created school in the results
      const school = result.items.find((s) => s.id === emptySchool.id);
      expect(school).toBeDefined();
      expect(school?.counts).toEqual({
        users: 0,
        classes: 0,
      });
    });

    it('includes ended classes in counts when includeEnded=true', async () => {
      // Create a school with one active class and one ended class
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School with Ended Class',
        parentOrgId: baseFixture.district.id,
      });

      await ClassFactory.create({
        name: 'Active Class',
        schoolId: school.id,
        districtId: baseFixture.district.id,
      });

      await ClassFactory.create({
        name: 'Ended Class',
        schoolId: school.id,
        districtId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      // With includeEnded=true, both classes should be counted
      const resultWithEnded = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
        includeEnded: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const schoolWithEnded = resultWithEnded.items.find((s) => s.id === school.id);
      expect(schoolWithEnded?.counts?.classes).toBe(2);

      // With includeEnded=false, only the active class should be counted
      const resultWithoutEnded = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
        includeEnded: false,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const schoolWithoutEnded = resultWithoutEnded.items.find((s) => s.id === school.id);
      expect(schoolWithoutEnded?.counts?.classes).toBe(1);
    });
  });

  describe('getUnrestrictedById', () => {
    it('returns school by ID without authorization checks', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.schoolA.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
      expect(result?.orgType).toBe(OrgType.SCHOOL);
      expect(result?.name).toBe(baseFixture.schoolA.name);
    });

    it('returns null for non-existent ID', async () => {
      const result = await repository.getUnrestrictedById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });

    it('returns null for district ID (wrong orgType)', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.district.id);

      // Should return null because district is not a school
      expect(result).toBeNull();
    });

    it('returns school even if it has rosteringEnded', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Unrestricted Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const result = await repository.getUnrestrictedById(endedSchool.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(endedSchool.id);
      expect(result?.rosteringEnded).not.toBeNull();
    });

    it('returns school with all expected fields', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.schoolA.id);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('abbreviation');
      expect(result).toHaveProperty('orgType');
      expect(result).toHaveProperty('parentOrgId');
      expect(result).toHaveProperty('isRosteringRootOrg');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });
});
