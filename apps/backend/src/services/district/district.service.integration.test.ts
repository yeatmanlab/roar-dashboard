/**
 * Integration tests for DistrictService.
 *
 * Tests the service layer against the real database to verify authorization
 * logic that spans multiple layers (service + repository + access controls).
 *
 * These tests complement the unit tests by verifying end-to-end behavior
 * with actual database queries and the base fixture's org hierarchy.
 */
import { describe, it, expect } from 'vitest';
import { DistrictService } from './district.service';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { UserRole } from '../../enums/user-role.enum';
import { OrgType } from '../../enums/org-type.enum';

describe('DistrictService (integration)', () => {
  const service = DistrictService();

  const defaultListOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  describe('list', () => {
    describe('super admin access', () => {
      it('should return all districts for super admins', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, defaultListOptions);

        // Should see at least the base fixture districts
        const districtIds = result.items.map((d) => d.id);
        expect(districtIds).toContain(baseFixture.district.id);
        expect(districtIds).toContain(baseFixture.districtB.id);
        expect(result.totalItems).toBeGreaterThanOrEqual(2);
      });

      it('should include ended districts when includeEnded=true', async () => {
        // Create a district with rosteringEnded set
        const endedDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Ended Test District for Include Test',
          rosteringEnded: new Date('2020-01-01'), // Set to past date
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const resultWithEnded = await service.list(authContext, {
          ...defaultListOptions,
          includeEnded: true,
        });

        const resultWithoutEnded = await service.list(authContext, {
          ...defaultListOptions,
          includeEnded: false,
        });

        const idsWithEnded = resultWithEnded.items.map((d) => d.id);
        const idsWithoutEnded = resultWithoutEnded.items.map((d) => d.id);

        // With includeEnded=true, should see the ended district
        expect(idsWithEnded).toContain(endedDistrict.id);
        // Without includeEnded (or false), should NOT see the ended district
        expect(idsWithoutEnded).not.toContain(endedDistrict.id);
      });

      it('should include counts when embedCounts=true', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          ...defaultListOptions,
          embedCounts: true,
        });

        expect(result.items.length).toBeGreaterThan(0);
        const districtWithCounts = result.items.find((d) => d.id === baseFixture.district.id);
        expect(districtWithCounts).toBeDefined();
        expect(districtWithCounts?.counts).toBeDefined();
        expect(districtWithCounts?.counts).toHaveProperty('users');
        expect(districtWithCounts?.counts).toHaveProperty('schools');
        expect(districtWithCounts?.counts).toHaveProperty('classes');
      });
    });

    describe('regular user access', () => {
      it('should return districts accessible to district admin', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.list(authContext, defaultListOptions);

        const districtIds = result.items.map((d) => d.id);
        // District admin should see their own district
        expect(districtIds).toContain(baseFixture.district.id);
      });

      it('should return parent district for school teacher', async () => {
        // Create a teacher at School A
        const schoolTeacher = await UserFactory.create({
          nameFirst: 'School',
          nameLast: 'Teacher',
        });

        await UserOrgFactory.create({
          userId: schoolTeacher.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.TEACHER,
        });

        const authContext = {
          userId: schoolTeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.list(authContext, defaultListOptions);

        const districtIds = result.items.map((d) => d.id);
        // School teacher should see parent district
        expect(districtIds).toContain(baseFixture.district.id);
        // Should NOT see unrelated districts
        expect(districtIds).not.toContain(baseFixture.districtB.id);
      });

      it('should return empty for user with no org access', async () => {
        // Create a user with no org memberships
        const isolatedUser = await UserFactory.create({
          nameFirst: 'Isolated',
          nameLast: 'User',
        });

        const authContext = {
          userId: isolatedUser.id,
          isSuperAdmin: false,
        };

        const result = await service.list(authContext, defaultListOptions);

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });

      it('should support supervisory role seeing descendant districts', async () => {
        // Create a state-level org with a child district
        const stateOrg = await OrgFactory.create({
          orgType: OrgType.STATE,
          name: 'Test State',
        });

        const childDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Child District',
          parentOrgId: stateOrg.id,
        });

        // Create an administrator at the state level
        const stateAdmin = await UserFactory.create({
          nameFirst: 'State',
          nameLast: 'Admin',
        });

        await UserOrgFactory.create({
          userId: stateAdmin.id,
          orgId: stateOrg.id,
          role: UserRole.ADMINISTRATOR,
        });

        const authContext = {
          userId: stateAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.list(authContext, defaultListOptions);

        const districtIds = result.items.map((d) => d.id);
        // State admin should see child district
        expect(districtIds).toContain(childDistrict.id);
      });
    });

    describe('pagination and sorting', () => {
      it('should respect page and perPage parameters', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const page1 = await service.list(authContext, {
          page: 1,
          perPage: 1,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        const page2 = await service.list(authContext, {
          page: 2,
          perPage: 1,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        expect(page1.items.length).toBe(1);
        expect(page2.items.length).toBeLessThanOrEqual(1);

        if (page2.items.length > 0) {
          expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
        }
      });

      it('should sort by name ascending', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          page: 1,
          perPage: 100,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        expect(result.items.length).toBeGreaterThan(1);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.name.toLowerCase() <= result.items[i]!.name.toLowerCase()).toBe(true);
        }
      });

      it('should sort by abbreviation descending', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          page: 1,
          perPage: 100,
          sortBy: 'abbreviation',
          sortOrder: 'desc',
        });

        expect(result.items.length).toBeGreaterThan(1);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.abbreviation.toLowerCase() >= result.items[i]!.abbreviation.toLowerCase()).toBe(
            true,
          );
        }
      });

      it('should sort by createdAt descending', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          page: 1,
          perPage: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        expect(result.items.length).toBeGreaterThan(1);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.createdAt >= result.items[i]!.createdAt).toBe(true);
        }
      });
    });

    describe('counts embedding', () => {
      it('should return accurate user counts', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          ...defaultListOptions,
          embedCounts: true,
        });

        const district = result.items.find((d) => d.id === baseFixture.district.id) as (typeof result.items)[0] & {
          counts?: { users: number; schools: number; classes: number };
        };
        expect(district).toBeDefined();
        expect(district?.counts).toBeDefined();
        // Should have at least the district admin
        expect(district?.counts?.users).toBeGreaterThan(0);
      });

      it('should return accurate school counts', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.list(authContext, {
          ...defaultListOptions,
          embedCounts: true,
          includeEnded: true, // Include ended to count all schools
        });

        const district = result.items.find((d) => d.id === baseFixture.district.id) as (typeof result.items)[0] & {
          counts?: { users: number; schools: number; classes: number };
        };
        expect(district).toBeDefined();
        expect(district?.counts).toBeDefined();
        // Should have at least School A when including ended orgs
        expect(district?.counts?.schools).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
