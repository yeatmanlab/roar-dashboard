/**
 * Integration tests for LtreeRepository.
 *
 * Exercises `getDistinctRootOrgIds()` through all three concrete subclasses
 * (DistrictRepository, SchoolRepository, ClassRepository) against the real
 * `app.orgs` and `app.classes` tables. The base fixture provides two
 * district branches plus their schools and classes — enough to verify both
 * single-input and mixed-input behavior across hierarchies.
 *
 * Coverage includes:
 * - Districts (self-rooted in orgs) — input id equals output id
 * - Schools (orgs-rooted in orgs) — returns the parent district id
 * - Classes (classes-rooted in orgs) — returns the root district id
 * - Mixed inputs spanning multiple branches → distinct roots, no duplicates
 * - Duplicate inputs → returns each root once
 * - Empty input array → short-circuits to `[]` without hitting the DB
 * - Nonexistent ids → silently dropped, no error thrown
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import { baseFixture } from '../test-support/fixtures';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { OrgType } from '../enums/org-type.enum';
import { DistrictRepository } from './district.repository';
import { SchoolRepository } from './school.repository';
import { ClassRepository } from './class.repository';

describe('LtreeRepository', () => {
  let districtRepository: DistrictRepository;
  let schoolRepository: SchoolRepository;
  let classRepository: ClassRepository;

  beforeAll(() => {
    districtRepository = new DistrictRepository();
    schoolRepository = new SchoolRepository();
    classRepository = new ClassRepository();
  });

  describe('getDistinctRootOrgIds (DistrictRepository — self-rooted)', () => {
    it('returns the same id for a single district (the root is itself)', async () => {
      const result = await districtRepository.getDistinctRootOrgIds([baseFixture.district.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns distinct roots when multiple districts are passed', async () => {
      const result = await districtRepository.getDistinctRootOrgIds([
        baseFixture.district.id,
        baseFixture.districtB.id,
      ]);

      const ids = result.map((row) => row.id).sort();
      expect(ids).toEqual([baseFixture.district.id, baseFixture.districtB.id].sort());
    });

    it('deduplicates duplicate input ids', async () => {
      const result = await districtRepository.getDistinctRootOrgIds([
        baseFixture.district.id,
        baseFixture.district.id,
        baseFixture.district.id,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns an empty array for nonexistent ids', async () => {
      const result = await districtRepository.getDistinctRootOrgIds(['00000000-0000-0000-0000-000000000000']);

      expect(result).toEqual([]);
    });
  });

  describe('getDistinctRootOrgIds (SchoolRepository — orgs-rooted in orgs)', () => {
    it('returns the parent district id for a single school', async () => {
      const result = await schoolRepository.getDistinctRootOrgIds([baseFixture.schoolA.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns the same district once when multiple schools share it', async () => {
      const result = await schoolRepository.getDistinctRootOrgIds([baseFixture.schoolA.id, baseFixture.schoolB.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns multiple districts when schools span branches', async () => {
      const result = await schoolRepository.getDistinctRootOrgIds([
        baseFixture.schoolA.id,
        baseFixture.schoolInDistrictB.id,
      ]);

      const ids = result.map((row) => row.id).sort();
      expect(ids).toEqual([baseFixture.district.id, baseFixture.districtB.id].sort());
    });
  });

  describe('getDistinctRootOrgIds (orgs-rooted multi-hop)', () => {
    // Orgs-rooted hierarchies (districts and schools both drive the orgs table)
    // share the same ltree traversal. Validate behavior more than two labels
    // deep — covers cases where the root isn't a direct parent.
    it('resolves a department two hops below the district to the district root', async () => {
      const department = await OrgFactory.create({
        name: 'Test Department',
        orgType: OrgType.DEPARTMENT,
        parentOrgId: baseFixture.schoolA.id,
      });

      // Either DistrictRepository or SchoolRepository works here — both drive
      // `orgs` and use the same ltree path. Use DistrictRepository since
      // "find the root district" is the canonical framing.
      const result = await districtRepository.getDistinctRootOrgIds([department.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });
  });

  describe('getDistinctRootOrgIds (ClassRepository — classes-rooted in orgs)', () => {
    it('returns the root district id for a single class', async () => {
      const result = await classRepository.getDistinctRootOrgIds([baseFixture.classInSchoolA.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('deduplicates classes that share a root', async () => {
      const result = await classRepository.getDistinctRootOrgIds([
        baseFixture.classInSchoolA.id,
        baseFixture.classInSchoolB.id,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns multiple roots when classes span districts', async () => {
      const result = await classRepository.getDistinctRootOrgIds([
        baseFixture.classInSchoolA.id,
        baseFixture.classInDistrictB.id,
      ]);

      const ids = result.map((row) => row.id).sort();
      expect(ids).toEqual([baseFixture.district.id, baseFixture.districtB.id].sort());
    });

    it('still resolves to the root after additional rows are added', async () => {
      // A new class under schoolB should still resolve to the District A root.
      const newClass = await ClassFactory.create({
        name: 'Late-Created Class',
        schoolId: baseFixture.schoolB.id,
        districtId: baseFixture.district.id,
      });

      const result = await classRepository.getDistinctRootOrgIds([newClass.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });
  });

  describe('getDistinctRootOrgIds (empty-input short-circuit)', () => {
    it('returns [] for an empty input array without hitting the database', async () => {
      // Inject a db client that throws on every call. If the method short-circuits
      // before invoking Drizzle, no method is called and the assertion passes.
      // If the implementation regresses and tries to query, the throwing handler
      // surfaces the bug clearly.
      const throwingDb = new Proxy(
        {},
        {
          get(_target, prop: string) {
            throw new Error(`Unexpected db access during empty-input short-circuit: ${String(prop)}`);
          },
        },
      ) as unknown as NodePgDatabase<typeof CoreDbSchema>;

      const repo = new DistrictRepository(throwingDb);
      const result = await repo.getDistinctRootOrgIds([]);

      expect(result).toEqual([]);
    });
  });
});
