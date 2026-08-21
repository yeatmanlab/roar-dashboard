import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  districtMembershipTuple,
  schoolMembershipTuple,
  classMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
  schoolHierarchyTuples,
  classHierarchyTuples,
  administrationDistrictTuple,
  administrationSchoolTuple,
  administrationClassTuple,
  administrationGroupTuple,
} from './fga-tuples';
import { UserRole } from '../../../enums/user-role.enum';
import { UserFamilyRole } from '../../../enums/user-family-role.enum';

/**
 * Parse all .fga.yaml test files from the authz package to extract every
 * writable (type, relation) pair from the `tuples:` section of each test file.
 *
 * IMPORTANT: This validates against what pairs appear in the YAML test fixtures,
 * NOT against the FGA model schema directly. When adding new relations or entity
 * types to the model, add a corresponding tuple to the appropriate .fga.yaml test
 * file, or this validation will not catch mismatches.
 *
 * Returns a Set of strings in the format "objectType:relation" (e.g., "district:teacher").
 */
function extractWritableTuplePairsFromModel(): Set<string> {
  const testsDir = resolve(__dirname, '../../../../../../packages/authz/tests');
  const pairs = new Set<string>();

  const files = readdirSync(testsDir).filter((f) => f.endsWith('.fga.yaml'));
  for (const file of files) {
    const content = readFileSync(join(testsDir, file), 'utf-8');
    const parsed = parse(content) as { tuples?: Array<{ user: string; relation: string; object: string }> };
    if (!parsed.tuples) continue;

    for (const tuple of parsed.tuples) {
      // Extract the object type prefix (e.g., "district" from "district:district-a")
      const objectType = tuple.object.split(':')[0]!;
      pairs.add(`${objectType}:${tuple.relation}`);
    }
  }

  return pairs;
}

/**
 * Extract the objectType:relation pair from a tuple for validation.
 */
function tuplePair(tuple: { user: string; relation: string; object: string }): string {
  const objectType = tuple.object.split(':')[0]!;
  return `${objectType}:${tuple.relation}`;
}

describe('fga-tuples model validation', () => {
  const validPairs = extractWritableTuplePairsFromModel();

  it('extracts at least 20 valid pairs from FGA model test files', () => {
    // The authz tests cover all entity types and their core role relations.
    // If this drops below 20, a test file has been deleted or the parser is broken.
    expect(validPairs.size).toBeGreaterThanOrEqual(20);
  });

  describe('membership tuples produce valid (objectType, relation) pairs', () => {
    const start = new Date('2024-01-01T00:00:00Z');

    it('districtMembershipTuple — teacher on district', () => {
      const pair = tuplePair(districtMembershipTuple('u1', 'd1', UserRole.TEACHER, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('districtMembershipTuple — administrator on district', () => {
      const pair = tuplePair(districtMembershipTuple('u1', 'd1', UserRole.ADMINISTRATOR, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('districtMembershipTuple — district_administrator on district', () => {
      const pair = tuplePair(districtMembershipTuple('u1', 'd1', UserRole.DISTRICT_ADMINISTRATOR, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('districtMembershipTuple — student on district', () => {
      const pair = tuplePair(districtMembershipTuple('u1', 'd1', UserRole.STUDENT, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('schoolMembershipTuple — teacher on school', () => {
      const pair = tuplePair(schoolMembershipTuple('u1', 's1', UserRole.TEACHER, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('schoolMembershipTuple — student on school', () => {
      const pair = tuplePair(schoolMembershipTuple('u1', 's1', UserRole.STUDENT, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('classMembershipTuple — student on class', () => {
      const pair = tuplePair(classMembershipTuple('u1', 'c1', UserRole.STUDENT, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('classMembershipTuple — teacher on class', () => {
      const pair = tuplePair(classMembershipTuple('u1', 'c1', UserRole.TEACHER, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('classMembershipTuple — guardian on class', () => {
      const pair = tuplePair(classMembershipTuple('u1', 'c1', UserRole.GUARDIAN, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('groupMembershipTuple — student on group', () => {
      const pair = tuplePair(groupMembershipTuple('u1', 'g1', UserRole.STUDENT, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('groupMembershipTuple — teacher on group', () => {
      const pair = tuplePair(groupMembershipTuple('u1', 'g1', UserRole.TEACHER, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('familyMembershipTuple — parent on family', () => {
      const pair = tuplePair(familyMembershipTuple('u1', 'f1', UserFamilyRole.PARENT, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('familyMembershipTuple — child on family', () => {
      const pair = tuplePair(familyMembershipTuple('u1', 'f1', UserFamilyRole.CHILD, start, null));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });
  });

  describe('hierarchy tuples produce valid (objectType, relation) pairs', () => {
    it('schoolHierarchyTuples — parent_org on school', () => {
      const [parentOrg] = schoolHierarchyTuples('d1', 's1');
      const pair = tuplePair(parentOrg);
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('schoolHierarchyTuples — child_school on district', () => {
      const [, childSchool] = schoolHierarchyTuples('d1', 's1');
      const pair = tuplePair(childSchool);
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('classHierarchyTuples — parent_org on class', () => {
      const [parentOrg] = classHierarchyTuples('s1', 'c1');
      const pair = tuplePair(parentOrg);
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('classHierarchyTuples — child_class on school', () => {
      const [, childClass] = classHierarchyTuples('s1', 'c1');
      const pair = tuplePair(childClass);
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });
  });

  describe('administration assignment tuples produce valid (objectType, relation) pairs', () => {
    it('administrationDistrictTuple — assigned_district on administration', () => {
      const pair = tuplePair(administrationDistrictTuple('a1', 'd1'));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('administrationSchoolTuple — assigned_school on administration', () => {
      const pair = tuplePair(administrationSchoolTuple('a1', 's1'));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('administrationClassTuple — assigned_class on administration', () => {
      const pair = tuplePair(administrationClassTuple('a1', 'c1'));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });

    it('administrationGroupTuple — assigned_group on administration', () => {
      const pair = tuplePair(administrationGroupTuple('a1', 'g1'));
      expect(validPairs.has(pair), `Tuple pair "${pair}" not found in FGA model test files`).toBe(true);
    });
  });
});
